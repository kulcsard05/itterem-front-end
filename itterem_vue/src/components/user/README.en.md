# User Components

Magyar verzió: [README.md](./README.md)

This folder contains the components that power the authenticated user experience: the account page, the login and registration forms, and the global cart drawer and checkout UI.

- This folder does not only contain route components. [CartDrawer.vue](./CartDrawer.vue), for example, is not part of the `/account` route itself; it is a shell-level component mounted by [../../App.vue](../../App.vue).
- The main functional areas here are auth entry, profile data handling, own-order tracking, and cart-driven checkout.
- The user area relies heavily on shared singleton composables, especially [../../composables/useAuth.js](../../composables/useAuth.js), [../../composables/useCart.js](../../composables/useCart.js), and [../../composables/useSignalR.js](../../composables/useSignalR.js).

## How This Folder Fits Into The Project

- The account route is registered in [../../router.js](../../router.js): `/account` -> [UserPage.vue](./UserPage.vue).
- [../../App.vue](../../App.vue) passes `auth` into the `router-view`, so `UserPage` does not fetch route-level auth state directly from the global store. It receives the current auth snapshot from the parent shell.
- The same [../../App.vue](../../App.vue) mounts [CartDrawer.vue](./CartDrawer.vue) under every non-employee view. That means cart UX is part of the shared public shell rather than a feature owned only by the account page.
- Login and registration depend on auth endpoints in [../../services/api.js](../../services/api.js), but session persistence and expiry handling are owned by [../../composables/useAuth.js](../../composables/useAuth.js).
- Own-order history and cart checkout are two different data paths: `UserPage` uses `getOwnOrders` for existing orders, while `CartDrawer` builds a fresh checkout payload from the singleton state in [../../composables/useCart.js](../../composables/useCart.js).
- Realtime user order updates come through [../../composables/useSignalR.js](../../composables/useSignalR.js), while status normalization is handled via [../../domain/order/order-dto.js](../../domain/order/order-dto.js).

## User Flow

1. The user arrives at `/account`, which renders [UserPage.vue](./UserPage.vue).
2. If the user is not signed in, `UserPage` locally switches between [Login.vue](./Login.vue) and [Register.vue](./Register.vue).
3. After a successful login, `UserPage` emits `login-success` upward, and [../../App.vue](../../App.vue) persists the auth state through [../../composables/useAuth.js](../../composables/useAuth.js).
4. For a normal signed-in user, `UserPage` loads own orders and the needed menu catalog subsets so it can reconstruct public item payloads from historical order entries.
5. Cart handling is separate from the account page: [CartDrawer.vue](./CartDrawer.vue) opens from the [../../App.vue](../../App.vue) shell header, renders the singleton cart state from [../../composables/useCart.js](../../composables/useCart.js), and places orders directly.

## Component Reference

### [UserPage.vue](./UserPage.vue)

- Purpose: the central account-route container that handles both the unauthenticated auth forms and the signed-in user profile/orders view.
- How it works: it receives an `auth` prop from [../../App.vue](../../App.vue). Based on that prop, it decides whether to render the login/register surface or the signed-in account page.
- How it works: in the unauthenticated state it does not switch routes between login and registration. Instead it uses local `currentForm` state to toggle between [Login.vue](./Login.vue) and [Register.vue](./Register.vue). That keeps the auth UX simple and avoids separate route definitions.
- How it works: in the signed-in state it does more than show profile data. It also owns phone-number editing, validates the input, then saves through `updatePhone` in [../../services/api.js](../../services/api.js). On success it emits `login-success` so the parent can refresh the top-level auth state and the [../../composables/useAuth.js](../../composables/useAuth.js) singleton remains consistent.
- How it works: for a normal user it loads own orders with `getOwnOrders`, then normalizes them through [../../domain/order/order-dto.js](../../domain/order/order-dto.js) and sorts them by date.
- How it works: for admin and employee accounts it intentionally skips loading both own orders and the public item catalogs. That matches the role routing logic and employee guard in [../../router.js](../../router.js).
- How it works: order entries are clickable. To support that, the component loads the meal/side/menu/drink catalogs and uses `createItemPayload` from [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js) to reconstruct a payload that [../../App.vue](../../App.vue) can forward into the public [../public/MenuItemPage.vue](../public/MenuItemPage.vue) flow exactly as if the user had opened the item from the menu page.
- How it works: for realtime status updates it subscribes to the `OrderUpdated` SignalR event through the `on` API from [../../composables/useSignalR.js](../../composables/useSignalR.js). It parses incoming payloads with `extractOrderUpdateEvent`, then either patches the known order status immediately or reloads own orders and shows a short success notice.
- How it works: order status is rendered through [../common/OrderStatusBadge.vue](../common/OrderStatusBadge.vue), which keeps badge color and labeling behavior aligned with the admin area.
- Main dependencies: [../../App.vue](../../App.vue), [../../router.js](../../router.js), [../../services/api.js](../../services/api.js), [../../composables/useSignalR.js](../../composables/useSignalR.js), [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js), [../../domain/order/order-dto.js](../../domain/order/order-dto.js), [../../shared/utils.js](../../shared/utils.js), [../common/OrderStatusBadge.vue](../common/OrderStatusBadge.vue), [../public/MenuItemPage.vue](../public/MenuItemPage.vue).

### [CartDrawer.vue](./CartDrawer.vue)

- Purpose: the global right-side drawer that renders cart contents and starts checkout.
- How it works: it receives `open` and `auth` from [../../App.vue](../../App.vue). It does not own visibility decisions itself; it only renders the state controlled by the parent shell.
- How it works: it reads the full cart state from the singleton [../../composables/useCart.js](../../composables/useCart.js). Because of that, the same cart source powers both menu-page add-to-cart controls and the drawer checkout surface.
- How it works: item-level quantity changes are not handled through a local copy. The drawer directly calls `addItem`, `decrementItem`, `removeItem`, and `clearCart` from `useCart`, which keeps the drawer and the rest of the cart-dependent UI in sync.
- How it works: during checkout it builds the API payload through `buildOrderItems` from [../../composables/useCart.js](../../composables/useCart.js), then submits it to `placeOrder` in [../../services/api.js](../../services/api.js). The request is wrapped by [../../composables/usePromiseTimeout.js](../../composables/usePromiseTimeout.js), so slow backend responses become explicit user-facing timeout errors.
- How it works: if there is no signed-in user or the cart does not contain valid items, ordering is blocked. User identity is resolved through `resolveUserId` from [../../shared/utils.js](../../shared/utils.js).
- How it works: after a successful order it shows a success state, clears the cart, and emits `order-success` upward. The actual drawer close behavior still belongs to [../../App.vue](../../App.vue).
- How it works: product images are rendered with [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue), while the actual image source is resolved by the `resolveImage` helper from `useCart`.
- Main dependencies: [../../App.vue](../../App.vue), [../../composables/useCart.js](../../composables/useCart.js), [../../composables/usePromiseTimeout.js](../../composables/usePromiseTimeout.js), [../../services/api.js](../../services/api.js), [../../shared/utils.js](../../shared/utils.js), [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue).

### [Login.vue](./Login.vue)

- Purpose: the sign-in form used inside the unauthenticated account view.
- How it works: it keeps email, password, loading, and field-error state locally. It does not persist auth sessions and does not directly mutate global auth state.
- How it works: field validation happens client-side, with email format checked through `isValidEmail` from [../../shared/utils.js](../../shared/utils.js). Validation is watched reactively, but only after the first submit attempt, so the form is not noisy on initial render.
- How it works: on successful submit it calls `login` from [../../services/api.js](../../services/api.js), then emits the returned user payload through `login-success`. The actual session persistence happens in the parent flow through [../../composables/useAuth.js](../../composables/useAuth.js), not inside this component.
- How it works: it asks the parent [UserPage.vue](./UserPage.vue) to switch views via the `switch` event.
- Main dependencies: [../../services/api.js](../../services/api.js), [../../shared/utils.js](../../shared/utils.js), [UserPage.vue](./UserPage.vue).

### [Register.vue](./Register.vue)

- Purpose: the sign-up form for creating a new account.
- How it works: it manages the full form state locally, including success and error feedback. Validation reuses shared helper functions for email and phone validation, while password length is checked against `PASSWORD_MIN_LENGTH` from [../../config/constants.js](../../config/constants.js).
- How it works: on submit it sends a payload to `register` in [../../services/api.js](../../services/api.js). One important contract detail is that the backend field is sent as `telefonSzam`, so that naming should be preserved unless the backend contract changes too.
- How it works: after successful registration it does not log the user in automatically. Instead it shows a success message, resets the form, then emits `switch` after a short timeout so the user returns to the login view.
- How it works: `onUnmounted` clears the timer so the component does not leave a dangling delayed action behind.
- Main dependencies: [../../services/api.js](../../services/api.js), [../../shared/utils.js](../../shared/utils.js), [../../config/constants.js](../../config/constants.js), [UserPage.vue](./UserPage.vue).

## Supporting Files Worth Reading With This Folder

- [../../App.vue](../../App.vue), because it passes `auth` into `UserPage`, handles `login-success` and `logout`, and mounts `CartDrawer` at the shell level.
- [../../router.js](../../router.js), because it shows the account route and the employee/admin role restrictions around it.
- [../../composables/useAuth.js](../../composables/useAuth.js), because it is the central singleton for session persistence, role derivation, and auth expiry handling.
- [../../composables/useCart.js](../../composables/useCart.js), because the drawer behavior depends on its storage hydration, quantity logic, and order-payload construction.
- [../../composables/useSignalR.js](../../composables/useSignalR.js), because it explains realtime user order updates.
- [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js), because `UserPage` uses it to transform order entries into reopenable public item payloads.
- [../../services/api.js](../../services/api.js), because login, register, updatePhone, getOwnOrders, and placeOrder all come from there.
- [../../domain/order/order-dto.js](../../domain/order/order-dto.js) and [../../domain/order/order-utils.js](../../domain/order/order-utils.js), because the user order list depends on their normalized shape.
- [../common/OrderStatusBadge.vue](../common/OrderStatusBadge.vue) and [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue), because these are the two main shared UI primitives used here.
- [../public/MenuItemPage.vue](../public/MenuItemPage.vue), because `UserPage` order-entry navigation ultimately lands in that public item-detail flow.

## Maintenance Rules

- Keep [../../composables/useAuth.js](../../composables/useAuth.js) as the single source of truth for auth state. Login and registration components should not grow their own session-persistence logic.
- Do not duplicate cart UI or checkout payload logic outside [../../composables/useCart.js](../../composables/useCart.js). Any new cart-facing UI should reuse the same singleton API.
- The `UserPage` order-entry to menu-item navigation path is a sensitive contract. If item payload structure changes, update [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js) and the [../../App.vue](../../App.vue) handoff together.
- Preserve the admin/employee exceptions. In the current design, own-order history and public item catalogs are only loaded for normal user accounts.