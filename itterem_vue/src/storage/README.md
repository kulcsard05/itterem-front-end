# Storage

Purpose: browser storage and cache-related helpers/modules.

Scope:
- Generic storage helpers (`storage-utils.js`).
- ETag and admin cache storage modules.

Rules:
- Handle storage failures defensively.
- Keep key naming and persistence strategy aligned with `src/config/constants.js`.