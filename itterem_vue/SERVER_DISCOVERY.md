# Server Discovery – Feature Documentation

Status: **implemented**, production-only (no-op in Vite dev mode)

---

## Overview

The server discovery feature lets the browser automatically locate the Itterem backend on the
local network without the user having to know the server's IP address. It scans the current LAN
subnet for an open port 7200, stores the discovered URL in `localStorage`, and gates the rest of
the app behind that URL.

---

## Files

| File | Role |
|---|---|
| `src/composables/useServerDiscovery.js` | All scanning logic, persistence helpers, reachability check |
| `src/components/ServerDiscovery.vue` | Modal UI: scan progress, manual input, status |
| `src/constants.js` | `SERVER_URL_STORAGE_KEY = 'itterem-server-url'` |
| `src/utils.js` → `getApiBaseUrl()` | Priority-1 read of the localStorage URL |
| `src/App.vue` | Startup check, navbar button, modal mount |

---

## How it works

### 1. Startup reachability check (`App.vue` → `onMounted`)

Runs in **production only** (`import.meta.env.DEV` is skipped).

1. Reads the current base URL via `getApiBaseUrl()` (which checks localStorage first, then
   `VITE_API_BASE_URL`).
2. Calls `checkServerReachable(baseUrl)` — a `fetch(..., { mode: 'no-cors' })` with a 4 s
   timeout.
3. If no URL is configured **or** the URL is unreachable → auto-opens `<ServerDiscovery>`.
4. Sets `serverReachable` (a `ref<boolean|null>`) which drives the navbar indicator dot.

### 2. Subnet detection (`detectLocalSubnet`)

Uses the browser's WebRTC `RTCPeerConnection` API (no STUN/TURN server needed):

1. Creates a data channel to trigger ICE candidate gathering.
2. Parses the first local ICE candidate for an IPv4 address.
3. Returns the `/24` prefix, e.g. `"192.168.40"`, within a 2 s deadline.
4. Returns `null` on failure (no WebRTC support, VPN, loopback-only, etc.).

### 3. Port probing (`scanSubnet` + `probeHost`)

- Scans all 254 host addresses (`.1` – `.254`) in the detected subnet.
- Fires **30 probes in parallel** per batch (`BATCH_SIZE = 30`).
- Each probe uses `fetch("http://{ip}:7200/", { mode: 'no-cors', signal })` with a
  **500 ms timeout** (`PROBE_TIMEOUT_MS`).
  - `mode: 'no-cors'` means the fetch resolves with an opaque response for _any_ HTTP reply,
    and rejects only on network failure (refused, timeout). No CORS headers are required on
    the backend for this to work.
- Stops immediately on the **first open host** found within the current batch.
- An outer `AbortController` is propagated to every probe so "Cancel" kills all in-flight
  requests.
- Progress is reported via an `onProbed` callback that increments `scanned`.

### 4. Persistence (`getApiBaseUrl` priority order)

`getApiBaseUrl()` in `utils.js` resolves the base URL in this order:

1. `localStorage.getItem('itterem-server-url')` — set by discovery or manual entry
2. `import.meta.env.VITE_API_BASE_URL` — `.env` file
3. `''` (empty, dev proxy) — only in Vite dev mode

All API calls and SSE connections go through `getApiBaseUrl()`, so once a URL is stored it
takes effect immediately on the next request without a page reload.

---

## UI (`ServerDiscovery.vue`)

- **Modal overlay** — dismissible by clicking the backdrop or the × button.
- **Current server pill** — shows the stored URL in green with a "Törlés" (clear) button.
- **Progress bar** — `scanned / 254` hosts with a percentage label.
- **"Automatikus keresés"** — starts the scan; becomes "Megszakítás" while scanning.
- **"Manuális"** — toggles a URL input field; validates with `new URL()` before saving.
- Emits `server-changed(url | null)` to `App.vue` when a URL is saved or cleared.

### Navbar button (`App.vue`)

A signal-tower icon button is always visible in the header (non-employee layout):

- No dot — reachability not yet checked (page just loaded).
- Green dot — last reachability check passed.
- Red dot — last check failed (prompts user to rescan).
- Tooltip changes to "Szerver nem elérhető – kattints a kereséshez" when red.

---

## Known limitations / future work

| # | Issue | Notes |
|---|---|---|
| 1 | **Batch scan exits on first hit per batch** — if the server is at `.31` it won't be found until batch 2 begins | Could use `Promise.any` within the batch instead of `Promise.all` to short-circuit faster |
| 2 | **Only scans /24 subnets** — doesn't handle /16 or multi-homed setups | Acceptable for typical home/office LAN |
| 3 | **WebRTC detection fails on some browsers / VPNs** | Falls back gracefully to the manual input |
| 4 | **No re-check after server-changed** — `serverReachable` is set optimistically to `true` when a URL is chosen, without a live confirmation | Could call `checkServerReachable` after setting the URL |
| 5 | **Dev mode entirely skipped** — by design; remove the `if (import.meta.env.DEV) return` guard if needed for local multi-machine testing |
| 6 | **Only the first discovered host is used** — if multiple servers are on the network, the one with the lowest host number wins |

---

## Configuration constants (all in `useServerDiscovery.js`)

```js
const PORT             = 7200;   // port to probe
const PROBE_TIMEOUT_MS = 500;    // per-host TCP probe timeout
const CONFIRM_TIMEOUT_MS = 4000; // startup reachability check timeout
const BATCH_SIZE       = 30;     // concurrent probes per batch
```
