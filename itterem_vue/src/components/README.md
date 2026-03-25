# Components

Purpose: Vue single-file components for all user-facing and admin-facing UI.

Structure:
- `public`: customer/public menu pages and related UI.
- `user`: account, auth, and cart-related UI.
- `admin`: administration and employee order-management UI.
- `common`: reusable presentational components shared across areas.

Rules:
- Keep components focused on rendering and interaction orchestration.
- Move reusable logic into composables instead of duplicating in templates.
