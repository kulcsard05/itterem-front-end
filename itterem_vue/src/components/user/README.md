# User Components

Purpose: authenticated user-facing account and ordering UI.

Scope:
- Login/register flows.
- User profile and own-order status tracking.
- Cart and checkout interaction shells.

Rules:
- Keep auth/session assumptions aligned with `useAuth` and router guards.
- Reuse shared order/status helpers instead of duplicating mapping logic.
