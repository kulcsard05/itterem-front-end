# Shared

Purpose: cross-cutting utilities reused across features.

Current modules:
- `utils.js`: validation helpers, normalization helpers, formatting helpers, auth/token utilities, and reusable mapping helpers.

Rules:
- Keep helpers pure when possible.
- If a helper becomes domain-specific, move it under `src/domain`.
- Do not include component-level state in this folder.
