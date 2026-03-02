# Backend review (actionable improvements)

This is a focused checklist to make the backend easier to consume from the Vue frontend and more robust in production. It’s based on the observed patterns in the controllers (notably `RendelesekController`), the current SSE endpoints (`/api/Rendelesek/stream` and `/api/Rendelesek/status-stream`), and the way JWT + policies are being used.

## 1) SSE contract: make it explicit and consistent

### Problems observed
- `/stream` emits JSON arrays that can be incremental (often “only new orders”), but this is not documented in-band.
- `/stream` emits a detailed “order DTO” shape with PascalCase-ish keys.
- `/status-stream` emits a small `{ id, status }`-style payload, and may not match the same casing.
- The frontend currently must:
  - merge/upsert arrays instead of replacing state
  - normalize casing differences
  - consume two different endpoints to keep UI consistent

### Recommended changes
- **Use SSE `event:` names** so clients can branch on event type without guessing payload shape.
  - Example events: `order.created`, `order.updated`, `order.statusChanged`.
- **Include an SSE `id:`** line for last-event-id based resuming.
  - This enables standard reconnection and makes “incremental since lastId” formal.
- **Add `retry:`** to hint reconnection delay.
- **Heartbeat**: write a comment ping periodically so proxies don’t kill idle connections.
  - Example: `:keep-alive\n\n` every ~15–30 seconds.

### Suggested event formats
Keep the payload casing and fields consistent across endpoints.

```text
event: order.created
id: 123
data: {"id":123,"felhasznaloId":7,"datum":"2026-03-02T10:11:12Z","statusz":"Függőben",...}

event: order.statusChanged
id: 123
data: {"id":123,"statusz":"Folyamatban"}
```

### Practical reliability headers
For SSE endpoints:
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`
- For reverse proxies (nginx): `X-Accel-Buffering: no`

## 2) Authorization: align access rules and avoid “auth surprises”

### Problems observed
- `stream` requires auth, and browsers’ native `EventSource` cannot send `Authorization` headers. This forces fetch-stream clients in the frontend.
- `/status-stream` auth should be aligned with `/stream` (and with who is allowed to see *all* orders).
- Policy names suggest role tiers (`Admin`, `Admin_Dolgozo`, `Felhasznalo`, `Mindenki`), but it’s not obvious which endpoints are intended for which roles.

### Recommended changes
- Decide who should be able to subscribe:
  - If employee board shows *all orders*, both `/stream` and `/status-stream` should likely be `Admin_Dolgozo`.
  - If normal users must subscribe, ensure the stream is filtered to their own orders.
- Make `/status-stream` explicitly protected with `[Authorize(Policy = "...")]`.
- Keep the auth requirement consistent between the two SSE endpoints.

### If you want native `EventSource`
If you want to keep `EventSource`, you need an auth mechanism that doesn’t rely on headers:
- **Same-origin cookie auth** (HttpOnly cookie session/JWT), plus CSRF protection for state-changing endpoints.
- (Less ideal) token passed in query string. This is generally discouraged because URLs leak via logs/referrers.

## 3) JSON casing and DTO consistency

### Problems observed
- The backend emits anonymous objects and different property naming styles across endpoints.

### Recommended changes
- Set a **single JSON naming policy** globally (usually camelCase) via `AddControllers().AddJsonOptions(...)`.
- Replace anonymous projections with stable DTO types for:
  - order list items
  - order details
  - status change events
- Keep SSE payloads and REST payloads aligned where possible.

## 4) Data access: stop new-ing DbContext in controllers

### Problems observed
- Many endpoints do `using (var cx = new BackEndAlapContext())` directly.
- Connection string appears hardcoded in the context (and EF already warns about it).

### Recommended changes
- Register `BackEndAlapContext` via DI (`AddDbContext`) and inject it into controllers/services.
- Move the connection string to configuration (`appsettings.json` + environment overrides / secrets).
- For long-running SSE loops, prefer:
  - `IDbContextFactory<BackEndAlapContext>` (create short-lived contexts per poll/iteration)
  - or a separate service that reads changes efficiently

## 5) Security correctness: derive user id from token, not request body

### Problems to double-check
- Any endpoint that accepts `felhasznaloId` (e.g., order creation) should not trust it blindly.

### Recommended changes
- For “user-owned” operations:
  - get user id from the JWT `sub` claim
  - ignore / validate any `felhasznaloId` from the request

This prevents a user from creating or viewing resources as another user by changing an id in JSON.

## 6) HTTP semantics and error handling

### Observed patterns
- Some endpoints return `200 OK` with an error string (e.g., “already exists”, “bad password”).

### Recommended changes
- Use status codes that match intent:
  - `401 Unauthorized` for bad credentials
  - `403 Forbidden` for authenticated-but-not-allowed
  - `409 Conflict` for “already exists”
  - `400 Bad Request` for validation issues
- For public API stability, consider returning structured error bodies.

## 7) Repo hygiene (quality-of-life)

- Ensure `bin/` and `obj/` are not committed (add to `.gitignore` and remove from git index).
- Keep secrets out of the repo:
  - DB connection strings
  - JWT keys

---

If you want, I can turn the SSE recommendations into a concrete backend patch (controller + service changes) once you paste the backend `Program.cs` / startup configuration (or link it if it’s in a different repo path), so policies + CORS + JSON naming are all handled consistently.
