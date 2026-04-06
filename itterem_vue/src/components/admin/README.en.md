# Admin Components

Magyar verzió: [README.md](./README.md)

This folder contains the role-protected operational UI for the restaurant frontend.

- The administrator CRUD surface is mounted at `/admin` through [../../router.js](../../router.js) and renders [AdminDashboard.vue](./AdminDashboard.vue).
- The employee order-management surface is mounted at `/rendeleskezeles` through [../../router.js](../../router.js) and renders [EmployeeOrders.vue](./EmployeeOrders.vue).
- Route access is enforced with the shared auth state from [../../composables/useAuth.js](../../composables/useAuth.js) and permission-denied notifications from [../../shared/utils.js](../../shared/utils.js).
- All backend communication is delegated to [../../services/api.js](../../services/api.js). These Vue files orchestrate state and UI, but they do not build fetch calls inline in the template layer.

## How The Admin Area Fits Into The Project

- The project is a Vue 3 application with public browsing, account pages, an admin dashboard, and an employee operations board. The admin folder is the operational part of that broader app, not a standalone feature silo.
- [AdminDashboard.vue](./AdminDashboard.vue) is configuration-driven. It does not hardcode table columns, form fields, or CRUD payload rules per entity. Instead it reads those rules from [../../composables/useAdminEntityConfigs.js](../../composables/useAdminEntityConfigs.js), which delegates to [../../composables/admin-entity-configs/buildEntityConfigs.js](../../composables/admin-entity-configs/buildEntityConfigs.js) and the per-entity config files in [../../composables/admin-entity-configs](../../composables/admin-entity-configs).
- [EmployeeOrders.vue](./EmployeeOrders.vue) is stateful and realtime-oriented. It combines polling, SignalR subscriptions, drag-and-drop status changes, DTO normalization, and local persistence for board/panel preferences.
- Shared admin CRUD rules live in [../../admin/admin-helpers.js](../../admin/admin-helpers.js). Shared order normalization rules live in [../../domain/order/order-dto.js](../../domain/order/order-dto.js) and [../../domain/order/order-utils.js](../../domain/order/order-utils.js).

## Admin CRUD Flow

- [AdminDashboard.vue](./AdminDashboard.vue) defines the visible tabs for orders, menus, categories, ingredients, meals, sides, and drinks.
- Data is loaded through [../../composables/useAdminDataLoader.js](../../composables/useAdminDataLoader.js), which first hydrates from [../../storage/admin-cache.js](../../storage/admin-cache.js) and then refreshes from [../../services/api.js](../../services/api.js).
- The active entity definition comes from [../../composables/useAdminEntityConfigs.js](../../composables/useAdminEntityConfigs.js). That config object supplies columns, form fields, validators, payload builders, API functions, and bulk-operation capabilities.
- [AdminTable.vue](./AdminTable.vue) renders the current tab using those config-driven columns.
- [AdminEditModal.vue](./AdminEditModal.vue) and [AdminFormField.vue](./AdminFormField.vue) render dynamic forms from the same config definitions.
- [AdminBulkEditModal.vue](./AdminBulkEditModal.vue) renders only the bulk actions that the current entity type supports.
- [ConfirmModal.vue](./ConfirmModal.vue) is reused for single delete confirmation, bulk delete confirmation, and bulk-action failure continuation.

## Employee Order Flow

- [EmployeeOrders.vue](./EmployeeOrders.vue) loads open orders from [../../services/api.js](../../services/api.js), normalizes them with [../../domain/order/order-dto.js](../../domain/order/order-dto.js), and groups them into pending, processing, and ready columns with [../../composables/useOrderColumns.js](../../composables/useOrderColumns.js).
- Realtime updates come from [../../composables/useSignalR.js](../../composables/useSignalR.js) and are coordinated by [../../composables/useEmployeeOrdersBoot.js](../../composables/useEmployeeOrdersBoot.js) plus [../../composables/useEmployeeOrderRealtimeEvents.js](../../composables/useEmployeeOrderRealtimeEvents.js).
- Dragging a card between columns persists the new status through [../../composables/useOrderStatusDnD.js](../../composables/useOrderStatusDnD.js), which calls `updateOrderStatus` in [../../services/api.js](../../services/api.js).
- The floating detail window is rendered by [FloatingOrderDetailsPanel.vue](./FloatingOrderDetailsPanel.vue) but its movement, resizing, and preference persistence are owned by [../../composables/useFloatingPanel.js](../../composables/useFloatingPanel.js).

## Component Reference

### [AdminDashboard.vue](./AdminDashboard.vue)

- Purpose: the main administrator shell for CRUD operations and bulk actions across every admin-managed entity.
- How it works: it keeps one `activeTab`, one data ref per entity collection, per-tab search queries, and modal state for edit, delete, bulk edit, and bulk delete. On mount it calls `loadAdminData()` from [../../composables/useAdminDataLoader.js](../../composables/useAdminDataLoader.js).
- How it works: it computes the current entity type from the selected tab, then looks up columns, form fields, validators, and API methods from [../../composables/useAdminEntityConfigs.js](../../composables/useAdminEntityConfigs.js). That composable is a thin wrapper over [../../composables/admin-entity-configs/buildEntityConfigs.js](../../composables/admin-entity-configs/buildEntityConfigs.js), which assembles [../../composables/admin-entity-configs/orderConfig.js](../../composables/admin-entity-configs/orderConfig.js), [../../composables/admin-entity-configs/menuConfig.js](../../composables/admin-entity-configs/menuConfig.js), [../../composables/admin-entity-configs/mealConfig.js](../../composables/admin-entity-configs/mealConfig.js), [../../composables/admin-entity-configs/categoryConfig.js](../../composables/admin-entity-configs/categoryConfig.js), [../../composables/admin-entity-configs/ingredientConfig.js](../../composables/admin-entity-configs/ingredientConfig.js), [../../composables/admin-entity-configs/sideConfig.js](../../composables/admin-entity-configs/sideConfig.js), and [../../composables/admin-entity-configs/drinkConfig.js](../../composables/admin-entity-configs/drinkConfig.js).
- How it works: search is accent-insensitive. The component normalizes both the query and each row's visible values before filtering. This is why search works consistently across names, formatted columns, and boolean availability badges.
- How it works: selection is delegated to [../../composables/useAdminSelectionState.js](../../composables/useAdminSelectionState.js), which keeps `selectedIds`, derives `selectedItems`, and exposes whether bulk edit or bulk delete is allowed for the current entity config.
- How it works: bulk edit logic is delegated to [../../composables/useAdminBulkActionEngine.js](../../composables/useAdminBulkActionEngine.js). That composable validates the requested bulk action, builds entity-specific update payloads, runs the queue sequentially, and asks [../../composables/useAdminBulkFailurePrompt.js](../../composables/useAdminBulkFailurePrompt.js) whether to continue after individual failures.
- How it works: image previews are handled through [../../composables/useObjectUrlPreview.js](../../composables/useObjectUrlPreview.js). Existing backend images stay visible until the user selects a new file, at which point a temporary object URL replaces the displayed preview.
- How it works: meal editing has an extra detail fetch. Before opening a meal modal, it calls `getMealById` from [../../services/api.js](../../services/api.js) so the form gets the full ingredient list instead of relying only on the table snapshot.
- How it works: the child components are loaded lazily with `defineAsyncComponent`, so the initial route load does not pay the cost of every modal and table immediately.
- Main dependencies: [AdminTable.vue](./AdminTable.vue), [AdminEditModal.vue](./AdminEditModal.vue), [AdminBulkEditModal.vue](./AdminBulkEditModal.vue), [ConfirmModal.vue](./ConfirmModal.vue), [../common/ErrorAlert.vue](../common/ErrorAlert.vue), [../../composables/useAdminDataLoader.js](../../composables/useAdminDataLoader.js), [../../composables/useAdminEntityConfigs.js](../../composables/useAdminEntityConfigs.js), [../../composables/useAdminSelectionState.js](../../composables/useAdminSelectionState.js), [../../composables/useAdminBulkActionEngine.js](../../composables/useAdminBulkActionEngine.js), [../../composables/useAdminBulkFailurePrompt.js](../../composables/useAdminBulkFailurePrompt.js), [../../composables/useObjectUrlPreview.js](../../composables/useObjectUrlPreview.js), [../../composables/useAuth.js](../../composables/useAuth.js), [../../services/api.js](../../services/api.js), [../../shared/utils.js](../../shared/utils.js), and [../../storage/admin-cache.js](../../storage/admin-cache.js).

### [AdminTable.vue](./AdminTable.vue)

- Purpose: the reusable table renderer used by every tab inside the admin dashboard.
- How it works: the parent passes a `columns` array and `items` array. The component does not know what an order, meal, or menu is; it only knows how to render generic columns, optional formatters, optional status badges, and optional availability badges.
- How it works: search input is fully controlled by the parent. This component only emits `update:searchQuery`, while [AdminDashboard.vue](./AdminDashboard.vue) owns the filtering logic.
- How it works: row selection supports click-like single selection and pointer-based drag selection. The `pointerdown`, `pointerenter`, and `pointerup` handlers let a user sweep across rows to toggle many checkboxes quickly.
- How it works: the header checkbox uses the DOM `indeterminate` state, synchronized in a `watch`, so partial selection is represented correctly.
- How it works: action buttons are also generic. The component emits `create`, `edit`, `delete`, `toggle-select-all`, and `toggle-select-item`, leaving all mutations to the parent container.
- Main dependencies: [../common/OrderStatusBadge.vue](../common/OrderStatusBadge.vue) and [../../shared/utils.js](../../shared/utils.js).

### [AdminEditModal.vue](./AdminEditModal.vue)

- Purpose: the create/edit modal for a single entity record.
- How it works: it receives a `fields` array and a `form` object from [AdminDashboard.vue](./AdminDashboard.vue). Each field definition is rendered by [AdminFormField.vue](./AdminFormField.vue), which lets one modal support many entity types.
- How it works: in edit mode it shows a read-only `id` field at the top. In create mode that field disappears and the action button label switches from save to create.
- How it works: image upload is optional and config-driven. If `showImageUpload` is true, the modal shows the currently resolved image preview plus a file input that emits `image-selected` back to the parent.
- How it works: it never mutates the incoming form in place. Every field update emits a cloned object through `update:form`, which keeps parent ownership explicit.
- Main dependencies: [AdminFormField.vue](./AdminFormField.vue), [../common/ErrorAlert.vue](../common/ErrorAlert.vue), and [../../shared/utils.js](../../shared/utils.js).

### [AdminFormField.vue](./AdminFormField.vue)

- Purpose: the field-level renderer behind [AdminEditModal.vue](./AdminEditModal.vue).
- How it works: it switches on `field.type` and renders `textarea`, `multiselect`, `select`, `number`, or plain text input variants.
- How it works: for `multiselect` fields it adds its own accent-insensitive search box, filters the option list locally, and maintains selection as a string-normalized set. This is primarily used for meal ingredient assignment.
- How it works: it stays intentionally dumb about validation. The config and parent modal decide what is valid; this component only reflects the provided field definition and emits `update:modelValue`.
- Main dependencies: [../../shared/utils.js](../../shared/utils.js).

### [AdminBulkEditModal.vue](./AdminBulkEditModal.vue)

- Purpose: the bulk-action modal used when the current entity type supports mass status, availability, or price changes.
- How it works: it computes the allowed action list from the `capabilities` object supplied by [AdminDashboard.vue](./AdminDashboard.vue). That means the UI changes automatically when the entity config changes.
- How it works: the selected action determines which secondary control is shown. Status actions render a status select, availability actions render a yes/no select, and price actions render a numeric delta input.
- How it works: this component does not apply the bulk mutation itself. It edits a parent-owned form object and emits `save`, while [../../composables/useAdminBulkActionEngine.js](../../composables/useAdminBulkActionEngine.js) does the real payload-building and queue execution.
- Main dependencies: [../common/ErrorAlert.vue](../common/ErrorAlert.vue), [../../config/constants.js](../../config/constants.js), and [../../shared/utils.js](../../shared/utils.js).

### [ConfirmModal.vue](./ConfirmModal.vue)

- Purpose: the shared confirmation dialog for dangerous or interruptive actions.
- How it works: it accepts a title, message, optional detail list, confirm/cancel labels, and a variant that changes the confirm button styling.
- How it works: because it accepts arbitrary detail strings, [AdminDashboard.vue](./AdminDashboard.vue) can reuse it for single deletes, bulk deletes, and “continue or stop” prompts after partial bulk-operation failures.
- How it works: it is presentation-only. It emits `confirm` and `cancel` and leaves all state transitions to the parent.
- Main dependencies: [../common/ErrorAlert.vue](../common/ErrorAlert.vue).

### [EmployeeOrders.vue](./EmployeeOrders.vue)

- Purpose: the employee-facing realtime kitchen and handoff board.
- How it works: on mount, [../../composables/useEmployeeOrdersBoot.js](../../composables/useEmployeeOrdersBoot.js) initializes the floating panel, loads orders, loads supporting catalog data, subscribes to SignalR events, starts polling, and tears everything down on unmount.
- How it works: orders are normalized through [../../domain/order/order-dto.js](../../domain/order/order-dto.js) and grouped into pending, processing, and ready lists by [../../composables/useOrderColumns.js](../../composables/useOrderColumns.js). That composable keeps an internal `orderIndex` map so updates and moves are fast.
- How it works: realtime updates are coordinated by [../../composables/useEmployeeOrderRealtimeEvents.js](../../composables/useEmployeeOrderRealtimeEvents.js). New orders can be inserted directly into the correct list, and status updates can patch an existing card in place. If a drag operation or save is in progress, the composable defers a full refresh instead of fighting the current interaction.
- How it works: drag-and-drop between columns is provided by `vuedraggable`, but persistence is handled by [../../composables/useOrderStatusDnD.js](../../composables/useOrderStatusDnD.js). That composable validates the dragged order, ensures the card actually lands in the expected column, persists the new status via [../../services/api.js](../../services/api.js), reloads orders, and applies a short cooldown to avoid immediate race-condition refreshes.
- How it works: a double activation on a card advances the order to the next status without dragging. This uses the shared `ORDER_STATUSES` list from [../../config/constants.js](../../config/constants.js) and the same `updateOrderStatus` API function used by drag-and-drop.
- How it works: board layout state is local-persisted. Collapsed/expanded columns, card display mode, and timer thresholds are written to local storage using [../../storage/storage-utils.js](../../storage/storage-utils.js). The detail panel position, size, and font size are managed separately by [../../composables/useFloatingPanel.js](../../composables/useFloatingPanel.js).
- How it works: ingredient detail lines in the floating panel are resolved by [../../composables/useOrderIngredientsLookup.js](../../composables/useOrderIngredientsLookup.js), which cross-references loaded meals and menus and falls back from ids to names when needed.
- How it works: UI-only derivations such as elapsed-time labels, selected-card highlighting, realtime indicator color, and per-column counts come from [../../composables/useEmployeeOrderDisplay.js](../../composables/useEmployeeOrderDisplay.js) and [../../composables/useEmployeeOrderBoardColumns.js](../../composables/useEmployeeOrderBoardColumns.js).
- Main dependencies: [FloatingOrderDetailsPanel.vue](./FloatingOrderDetailsPanel.vue), [../../composables/useSignalR.js](../../composables/useSignalR.js), [../../composables/useEmployeeOrdersBoot.js](../../composables/useEmployeeOrdersBoot.js), [../../composables/useEmployeeOrderRealtimeEvents.js](../../composables/useEmployeeOrderRealtimeEvents.js), [../../composables/useOrderColumns.js](../../composables/useOrderColumns.js), [../../composables/useOrderStatusDnD.js](../../composables/useOrderStatusDnD.js), [../../composables/useFloatingPanel.js](../../composables/useFloatingPanel.js), [../../composables/useEmployeeOrderDisplay.js](../../composables/useEmployeeOrderDisplay.js), [../../composables/useEmployeeOrderBoardColumns.js](../../composables/useEmployeeOrderBoardColumns.js), [../../composables/useOrderIngredientsLookup.js](../../composables/useOrderIngredientsLookup.js), [../../composables/useAuth.js](../../composables/useAuth.js), [../../services/api.js](../../services/api.js), [../../domain/order/order-dto.js](../../domain/order/order-dto.js), [../../domain/order/order-utils.js](../../domain/order/order-utils.js), [../../shared/utils.js](../../shared/utils.js), [../../storage/storage-utils.js](../../storage/storage-utils.js), and [../../config/constants.js](../../config/constants.js).

### [FloatingOrderDetailsPanel.vue](./FloatingOrderDetailsPanel.vue)

- Purpose: the movable, resizable detail view for the order currently selected in [EmployeeOrders.vue](./EmployeeOrders.vue).
- How it works: it is mostly presentational. The parent supplies the selected order, precomputed entry view models, current geometry, current font size, and all drag/resize handlers.
- How it works: it exposes its root element through `defineExpose`, which allows [EmployeeOrders.vue](./EmployeeOrders.vue) and [../../composables/useFloatingPanel.js](../../composables/useFloatingPanel.js) to react when the actual panel element changes.
- How it works: the header handles drag gestures, the bottom-right and edge handles manage resize gestures, and the close button simply emits `close-panel` back to the parent.
- How it works: status rendering is delegated to the shared badge component, while item timestamps and customer details are formatted through shared utilities.
- Main dependencies: [../common/OrderStatusBadge.vue](../common/OrderStatusBadge.vue), [../../shared/utils.js](../../shared/utils.js), and the parent-managed handlers from [../../composables/useFloatingPanel.js](../../composables/useFloatingPanel.js).

## Supporting Files Worth Reading With This Folder

- [../../router.js](../../router.js) for route-level role guards and route entry points.
- [../../composables/useAuth.js](../../composables/useAuth.js) for shared auth state used by route guards and action guards.
- [../../services/api.js](../../services/api.js) for every CRUD function, order-status update, and admin dataset fetch used here.
- [../../composables/useAdminEntityConfigs.js](../../composables/useAdminEntityConfigs.js) and [../../composables/admin-entity-configs](../../composables/admin-entity-configs) for the config-driven admin schema.
- [../../admin/admin-helpers.js](../../admin/admin-helpers.js) for shared validation, payload, and price-adjustment rules.
- [../../composables/useAdminDataLoader.js](../../composables/useAdminDataLoader.js) and [../../storage/admin-cache.js](../../storage/admin-cache.js) for cache-first admin loading.
- [../../composables/useSignalR.js](../../composables/useSignalR.js) for the app-wide SignalR singleton used by employee operations.
- [../../domain/order/order-dto.js](../../domain/order/order-dto.js) and [../../domain/order/order-utils.js](../../domain/order/order-utils.js) for backend-contract normalization around order payloads.

## Maintenance Notes

- Preserve prop and emit contracts carefully. [AdminDashboard.vue](./AdminDashboard.vue), [AdminTable.vue](./AdminTable.vue), and the modal components are tightly coupled through those contracts even though the rendering is generic.
- When changing admin entity behavior, update the relevant config in [../../composables/admin-entity-configs](../../composables/admin-entity-configs) before adding conditional logic directly to [AdminDashboard.vue](./AdminDashboard.vue).
- When changing employee board behavior, check both polling and SignalR flows. The board is intentionally defensive and often prefers a deferred reload over optimistic mutation during drag/save windows.