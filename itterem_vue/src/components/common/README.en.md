# Common Components

Magyar verzió: [README.md](./README.md)

This folder contains small reusable UI building blocks shared across multiple feature areas.

- These components are not feature containers. They are shared presentational primitives.
- Their job is to standardize repeated UI patterns so the admin, public, and user areas do not each implement the same thing differently.
- Most of them are stateless or only keep minimal UI-local state.

## How This Folder Fits Into The Project

- Components in `common` are imported from [../admin](../admin), [../public](../public), and [../user](../user).
- These files generally do not own business logic, API calls, or global state.
- When they do keep internal state, it is UI-specific behavior such as image loading state or fallback timing.

## Component Reference

### [ErrorAlert.vue](./ErrorAlert.vue)

- Purpose: a single, consistent error block for places where a parent component simply wants to render a textual error message.
- How it works: it accepts two props, a `message` string and an optional `wrapperClass`. If `message` is empty, the component renders nothing.
- How it works: the visual styling is fixed, so the component gives the same red alert treatment across different screens. The parent only controls outer spacing and placement through `wrapperClass`.
- How it works: it does not handle errors, normalize messages, or resolve locale keys. The parent or service layer is responsible for producing the final message.
- Where it is used: mainly in admin modals and admin surfaces such as [../admin/AdminDashboard.vue](../admin/AdminDashboard.vue), [../admin/AdminEditModal.vue](../admin/AdminEditModal.vue), [../admin/AdminBulkEditModal.vue](../admin/AdminBulkEditModal.vue), and [../admin/ConfirmModal.vue](../admin/ConfirmModal.vue).
- Main dependencies: none; it is a purely prop-driven presentational component.

### [ImageWithFallback.vue](./ImageWithFallback.vue)

- Purpose: a shared image-rendering component for places where the image may be missing, slow to arrive, or fail to load.
- How it works: it keeps a small state machine with `loading`, `loaded`, and `error` states. Based on that state, it decides whether to render the actual image, a skeleton placeholder, or a fallback view.
- How it works: when `src` exists, the component tries to load the image and switches state through the `@load` and `@error` handlers. When `src` is empty, it does not immediately fail into fallback mode. Instead it waits for a short delay. This comes from the `emptyFallbackDelayMs` prop and avoids unnecessary flicker when the source is temporarily empty or arrives slightly late.
- How it works: the skeleton and fallback views are also configurable through class props (`wrapperClass`, `imgClass`, `skeletonClass`, `fallbackClass`), so the same logic can be reused across different layouts without duplicating the component.
- How it works: the fallback icon is visual, while `fallbackLabel` can provide screen-reader text through an `sr-only` span.
- Where it is used: across the public and user areas, for example in [../public/MenuItemPage.vue](../public/MenuItemPage.vue), [../public/QuickBuyModal.vue](../public/QuickBuyModal.vue), [../public/MenuItemCardShell.vue](../public/MenuItemCardShell.vue), and [../user/CartDrawer.vue](../user/CartDrawer.vue).
- Main dependencies: Vue reactivity (`computed`, `ref`, `watch`, `onBeforeUnmount`); it has no domain or API dependency.

### [OrderStatusBadge.vue](./OrderStatusBadge.vue)

- Purpose: a single consistent badge for displaying order statuses across different parts of the UI.
- How it works: it computes the visual class from the `status` prop by looking up [../../config/constants.js](../../config/constants.js) `ORDER_STATUS_CLASSES`. If the status is unknown, it falls back to `fallbackClass`.
- How it works: the rendered label can be overridden with the `label` prop. If there is no explicit label, it displays the textual `status` value, and finally `-` as a last fallback.
- How it works: the base size and shape come from `baseClass`, while `extraClass` allows local tuning. That is why the same component works both in compact table cells and in larger detail views.
- Where it is used: in both admin and user-facing areas, for example [../admin/AdminTable.vue](../admin/AdminTable.vue), [../admin/FloatingOrderDetailsPanel.vue](../admin/FloatingOrderDetailsPanel.vue), and [../user/UserPage.vue](../user/UserPage.vue).
- Main dependencies: [../../config/constants.js](../../config/constants.js) for the status-to-class mapping.

## Supporting Files Worth Reading With This Folder

- [../../config/constants.js](../../config/constants.js) for the visual status mapping consumed by `OrderStatusBadge`.
- [../admin/AdminDashboard.vue](../admin/AdminDashboard.vue), [../admin/AdminEditModal.vue](../admin/AdminEditModal.vue), [../admin/AdminBulkEditModal.vue](../admin/AdminBulkEditModal.vue), and [../admin/ConfirmModal.vue](../admin/ConfirmModal.vue) to see how the admin UI uses `ErrorAlert`.
- [../public/MenuItemCardShell.vue](../public/MenuItemCardShell.vue), [../public/MenuItemPage.vue](../public/MenuItemPage.vue), [../public/QuickBuyModal.vue](../public/QuickBuyModal.vue), and [../user/CartDrawer.vue](../user/CartDrawer.vue) for representative `ImageWithFallback` usage in different layouts.
- [../admin/AdminTable.vue](../admin/AdminTable.vue), [../admin/FloatingOrderDetailsPanel.vue](../admin/FloatingOrderDetailsPanel.vue), and [../user/UserPage.vue](../user/UserPage.vue) to see how `OrderStatusBadge` scales across different UI contexts.

## Maintenance Rules

- Keep these components general-purpose. If a prop or behavior would only make sense for one feature, first question whether it belongs in the feature component instead.
- Do not move API calls, route logic, or auth-specific behavior into this folder.
- Visual reuse matters more than short-term optimization for a single screen.
- If a component needs different spacing or sizing in many places, prefer adding class props over cloning the component.