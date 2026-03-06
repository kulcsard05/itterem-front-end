# Server Discovery – Dev Workflow

Status: **development-only**, helper-backed migration in progress

---

## Overview

Server discovery is no longer a production browser feature.

The app now treats LAN discovery as a **developer convenience** that belongs outside the browser:

- production builds do **not** expose server discovery UI or runtime behavior
- development builds use the Vite proxy and can be started through a local discovery helper
- the long-term source of truth for discovered backend URLs is a local Python helper, not `fetch()`
  probes from the browser

This change removes the old assumption that the frontend can reliably detect the LAN subnet and
scan port `7200` from browser JavaScript.

---

## Current frontend behavior

### Production

- `src/App.vue` no longer mounts or exposes the discovery UI.
- `src/utils.js` reads `VITE_API_BASE_URL` for non-dev builds.
- Production builds do not depend on local discovery state.

### Development

- `src/utils.js` always returns `''` from `getApiBaseUrl()` in dev.
- All browser requests stay same-origin and flow through Vite's proxy.
- The recommended entry point is `npm run dev` or `npm run dev:discover`, which start the helper-backed
  launcher before Vite.

---

## Dev startup flow

### 1. Launcher script

`scripts/dev-with-discovery.mjs` is responsible for the developer workflow:

1. start the local Python discovery helper
2. ask the helper to discover a backend on port `7200`
3. receive a verified backend URL
4. launch Vite with `VITE_API_BASE_URL=<discovered-url>`

### 2. Vite proxy

`vite.config.js` reads `process.env.VITE_API_BASE_URL` first, then `.env`, then falls back to
`http://localhost:7200`.

That proxy target is used for:

- `/api`
- `/orderHub`

This keeps the frontend code simple: in dev, the browser only talks to Vite.

### 3. Helper verification

The Python helper is expected to:

- enumerate real local IPv4 networks on macOS and Windows
- probe candidate hosts on port `7200`
- verify that a responding host is actually the Itterem backend before accepting it
- cache the last known good result for faster startup

---

## Files

| File | Role |
|---|---|
| `src/App.vue` | production no longer exposes discovery UI |
| `src/utils.js` | dev always uses the Vite proxy; production uses explicit base URL |
| `vite.config.js` | reads launcher-provided `VITE_API_BASE_URL` |
| `scripts/dev-with-discovery.mjs` | dev launcher that bridges helper output into Vite |
| `devtools/server_discovery_helper/` | local helper implementation |

---

## Recommended commands

```bash
npm run dev
```

Raw Vite startup is still available when needed:

```bash
npm run dev:raw
```

---

## Notes

- The legacy browser-side `useServerDiscovery.js` and `ServerDiscovery.vue` files remain in the repo
  during the migration, but they are no longer part of the production runtime path.
- The reliable version of discovery should happen in the helper layer, not in the browser.
