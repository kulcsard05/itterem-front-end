# Itterem Frontend (Vue + Vite)

Frontend client for the Itterem restaurant app.

## Requirements

- Node.js 20+
- npm 10+

Optional for automatic backend discovery during local development:

- Python 3.10+
- Python dependency: `psutil` (see `devtools/server_discovery_helper/requirements.txt`)

## Install

```bash
npm install
```

## Environment

Create a local environment file:

```bash
cp .env.example .env
```

Example:

```env
VITE_API_BASE_URL=http://localhost:7200
```

Notes:

- `.env` is ignored by git.
- `VITE_API_BASE_URL` can also be provided by the discovery launcher at runtime.

## Development Commands

- `npm run dev`
	- Starts the discovery-aware launcher (`scripts/dev-with-discovery.mjs`).
	- Tries backend discovery first, falls back to `VITE_API_BASE_URL` when needed.

- `npm run dev:discover`
	- Same as `npm run dev`.

- `npm run dev:raw`
	- Starts plain Vite without running discovery logic.

## Build

```bash
npm run build
```

## Preview Production Build

```bash
npm run preview
```

## Discovery Helper Notes

- Helper source is under `devtools/server_discovery_helper`.
- Frontend helper connection settings use:
	- `VITE_DISCOVERY_HELPER_HOST`
	- `VITE_DISCOVERY_HELPER_PORT`
- The launcher accepts internal overrides via:
	- `ITTEREM_DISCOVERY_HELPER_HOST`
	- `ITTEREM_DISCOVERY_HELPER_PORT`
	- `ITTEREM_DISCOVERY_TIMEOUT_MS`
	- `ITTEREM_DISCOVERY_SKIP=1`

## Main App Structure

- `src/components` UI components
- `src/composables` shared state and app logic
- `src/services` backend API layer
- `src/domain` domain-specific DTO/normalization helpers
- `src/shared` cross-cutting utility helpers
- `src/config` application constants and configuration
- `src/router.js` route and role guard logic
- `src/locales` language resources

## Dependencies

- `vue`, `vue-router`, `vue-i18n`
	- Core framework, route-level role/locale navigation, and localization.

- `@microsoft/signalr`
	- Real-time order updates used by account and employee order-management flows.
	- Connection lifecycle is centralized in `src/composables/useSignalR.js`.

- `vuedraggable`
	- Drag-and-drop interaction for employee order status board only.
	- Used in `src/components/admin/EmployeeOrders.vue` for status transitions.

- `tailwindcss`, `postcss`, `autoprefixer`, `@tailwindcss/postcss`
	- Utility-first styling pipeline and CSS post-processing in Vite build.

- `@vitejs/plugin-vue`, `vite`
	- Vue SFC transform and local dev/build toolchain.
