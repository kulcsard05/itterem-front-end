# Order Domain

Purpose: order-specific data contracts and normalization logic.

Current modules:
- `order-utils.js`: safe field readers and status/id helpers for backend payload variations.
- `order-dto.js`: DTO normalization and event payload extraction.

Rules:
- Keep backend contract adaptation for orders in this folder.
- Do not place generic app helpers here.
- Any order field-name fallback changes should be reviewed with backend contract notes.
