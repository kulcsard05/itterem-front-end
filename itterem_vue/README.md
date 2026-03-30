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

- `npm run generate:seed -- --image-source placeholder`
	- Generates demo SQL seed data with locally rendered placeholder images.
	- Useful when you want a fully offline run without external image APIs.

- `npm run generate:seed -- --image-source pexels`
	- Generates demo SQL seed data with downloaded food photos from Pexels.
	- Writes both the SQL import file and an attribution manifest.

## Build

```bash
npm run build
```

## Preview Production Build

```bash
npm run preview
```

Notes:

- `npm run preview -- --host` now rebuilds before serving, so preview always matches the current source.
- When the preview page is opened from another LAN device and `VITE_API_BASE_URL` points to `localhost`, the app falls back to same-origin `/api` and `/orderHub` requests so Vite preview can proxy them back to the backend running on your machine.

## Demo Seed Generator

The project now includes a catalog seed generator at `scripts/generate-demo-seed.mjs`.

What it does:

- builds SQL inserts for categories, ingredients, meals, sides, drinks, and menus
- embeds image blobs directly into the generated SQL
- supports both placeholder-image mode and real-photo Pexels mode
- writes image attribution metadata when Pexels mode is used

Generated files:

- `generated-demo-seed.sql`
- `generated-demo-seed-image-attribution.json`

Notes:

- the SQL file is intentionally large because images are embedded as hex BLOB values
- Pexels mode needs a local API key in `.env.local`
- on macOS the script uses `sips` to normalize images into JPEG blobs

Detailed usage, setup, and troubleshooting are documented in [DEMO_SEED_README.md](./DEMO_SEED_README.md).

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
