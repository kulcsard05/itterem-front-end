# Services

Purpose: backend communication boundaries.

Current modules:
- `api.js`: HTTP requests, request helpers, auth-failure handling, and endpoint-level API functions.

Rules:
- Service modules can call browser APIs (`fetch`, `AbortController`) and storage helpers when needed.
- Keep endpoint contracts explicit.
- Avoid importing UI components or Vue SFC modules.

Authorization UX contract:
- Backend authorization remains the source of truth. Frontend checks are only UX improvements.
- When a logged-in user lacks permission, backend endpoints should return HTTP `403` with a meaningful message payload (`message`, `error`, `detail`, or `title`).
- The frontend normalizes these responses and emits a global permission-denied notification while preserving local inline error feedback near the failed action.
