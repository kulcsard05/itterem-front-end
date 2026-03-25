# Admin Components

Purpose: admin and employee operational UI components.

Scope:
- Admin CRUD tables and modals.
- Employee order board and realtime operational panels.

Rules:
- Keep API calls in services/composables, not inline in templates.
- Preserve event and prop contracts carefully because many parent components depend on them.
