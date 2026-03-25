# Source Overview

Purpose: top-level frontend application source.

Main entry points:
- `main.js`: Vue app bootstrap and global setup.
- `App.vue`: app shell and shared layout wiring.
- `router.js`: route definitions and role/locale guards.
- `i18n.js`: translation setup.

Folder map:
- `admin`: admin-specific helper logic.
- `components`: Vue UI components split by feature area.
- `composables`: reusable Vue composition logic.
- `config`: constants and static configuration.
- `domain`: domain-specific parsing/normalization logic.
- `locales`: translation resource files.
- `menu`: menu-specific helper logic.
- `services`: backend API interaction layer.
- `shared`: cross-cutting utility functions.
- `storage`: storage-related helpers and modules.