# Admin Entity Configs

Purpose: per-entity configuration for admin CRUD behavior.

Scope:
- Columns, form fields, validation, payload builders, and API wiring per entity type.

Rules:
- Keep each entity configuration isolated and predictable.
- Shared config helpers should live in shared modules inside this folder.
