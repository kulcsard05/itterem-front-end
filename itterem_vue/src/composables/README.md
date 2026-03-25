# Composables

Purpose: reusable Vue Composition API logic modules.

Scope:
- Shared state holders (cart, auth, locale, menu data).
- Feature logic orchestration (admin loading, realtime events, drag-and-drop helpers).
- UI behavior hooks (panels, animations, persisted tab state).

Rules:
- Document when a composable is module-singleton state.
- Prefer explicit inputs/outputs; avoid hidden cross-module coupling.
