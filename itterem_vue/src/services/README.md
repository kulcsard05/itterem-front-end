# Services

Purpose: backend communication boundaries.

Current modules:
- `api.js`: HTTP requests, request helpers, auth-failure handling, and endpoint-level API functions.

Rules:
- Service modules can call browser APIs (`fetch`, `AbortController`) and storage helpers when needed.
- Keep endpoint contracts explicit.
- Avoid importing UI components or Vue SFC modules.
