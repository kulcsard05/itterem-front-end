# Admin Helpers

Purpose: helper functions used by admin dashboards and admin entity configuration modules.

Scope:
- Common validation helpers for admin forms.
- Common payload/field transformation helpers for admin actions.

Rules:
- Keep this folder UI-framework agnostic where possible.
- If logic becomes entity-specific, move it under `src/composables/admin-entity-configs`.
