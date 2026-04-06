# Public Components

Magyar verzió: [README.md](./README.md)

This folder contains the customer-facing public experience: menu browsing, the item detail view, the quick-order modal, informational pages, and the smaller UI building blocks that support them.

- This is the primary customer-facing area of the project, so most visitors interact with these components first.
- The folder mixes route-level views with smaller reusable public UI elements.
- Most of the heavier state management and data shaping is pushed into composables, so these components are usually focused on orchestration and presentation.

## How This Folder Fits Into The Project

- Public routes are registered in [../../router.js](../../router.js): `/` -> `MenuView`, `/item` -> `MenuItemPage`, `/about` -> `AboutUs`, and the catch-all route -> `NotFound`.
- The overall page shell is owned by [../../App.vue](../../App.vue). App provides the header, the `router-view` event contract, the cart drawer, and the global footer.
- The shared source of public menu data is [../../composables/useMenuData.js](../../composables/useMenuData.js). It manages localStorage cache hydration, dataset coherence, and persistent image references.
- Network refresh logic lives in [../../composables/useMenuCatalogRefresh.js](../../composables/useMenuCatalogRefresh.js). It performs per-endpoint conditional fetches, status tracking, and background image caching.
- Shared item name, price, image, meta, and menu-breakdown logic comes from [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js) and [../../menu/menu-utils.js](../../menu/menu-utils.js).
- Most public components that render images rely on the shared [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue), so image loading and fallback behavior stays consistent.

## Public User Flow

1. [MenuView.vue](./MenuView.vue) builds the menu from cache and API data, then renders products as tabs and lists.
2. When the user opens an item, `MenuView` emits `open-item` upward to [../../App.vue](../../App.vue). App stores the selected item in `sessionStorage` and then navigates to `MenuItemPage`.
3. [MenuItemPage.vue](./MenuItemPage.vue) does not perform its own fetch by `id`. The route depends on `itemData` passed from the parent shell, so direct entry falls back to the menu when that state is missing.
4. Adding to cart has two paths: the normal flow emits `add-to-cart` upward, while quick ordering uses [QuickBuyModal.vue](./QuickBuyModal.vue) to place an order directly.
5. [FooterSection.vue](./FooterSection.vue) is not limited to the `about` page. [../../App.vue](../../App.vue) mounts it under every non-employee view, so it is effectively part of the whole public shell.

## Component Reference

### [MenuView.vue](./MenuView.vue)

- Purpose: the main menu page and the central container for the public catalog.
- How it works: it lazy-loads smaller public helper components with `defineAsyncComponent`, including [AsyncStatePanel.vue](./AsyncStatePanel.vue), [EndpointStatusBadges.vue](./EndpointStatusBadges.vue), [MenuAddToCartButton.vue](./MenuAddToCartButton.vue), [MenuItemCardShell.vue](./MenuItemCardShell.vue), [MenuQuickOrderButton.vue](./MenuQuickOrderButton.vue), and [QuickBuyModal.vue](./QuickBuyModal.vue). That keeps the initial bundle lighter.
- How it works: it reads the shared menu datasets from [../../composables/useMenuData.js](../../composables/useMenuData.js). Because of that, the public menu, cart rehydration, and other consumers all rely on the same reactive dataset source.
- How it works: it refreshes data through [../../composables/useMenuCatalogRefresh.js](../../composables/useMenuCatalogRefresh.js), which loads categories, meals, sides, menus, and drinks independently. The component uses that state for loading, error, and debug-status rendering.
- How it works: the active tab is persisted by [../../composables/usePersistedMenuTab.js](../../composables/usePersistedMenuTab.js), so a page refresh keeps the user on the same menu tab.
- How it works: meal sections are assembled by [../../composables/useMealSections.js](../../composables/useMealSections.js). That means the component does not need to care whether the backend returned nested category data or a flat meal list.
- How it works: item detail payloads are created by [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js). The same layer also computes menu meta text, ingredient labels, and resolved meal/side/drink parts.
- How it works: add-to-cart feedback animation is managed by [../../composables/useTransientSetAnimation.js](../../composables/useTransientSetAnimation.js) using stable keys, so multiple cards can animate independently and predictably.
- How it works: the component does not directly own global cart mutations. Instead it emits `open-item` and `add-to-cart` upward to [../../App.vue](../../App.vue), where route changes and cart state updates actually happen.
- How it works: for quick ordering it opens [QuickBuyModal.vue](./QuickBuyModal.vue) locally, because that flow bypasses the normal cart path.
- Main dependencies: [../../composables/useMenuData.js](../../composables/useMenuData.js), [../../composables/useMenuCatalogRefresh.js](../../composables/useMenuCatalogRefresh.js), [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js), [../../composables/usePersistedMenuTab.js](../../composables/usePersistedMenuTab.js), [../../composables/useMealSections.js](../../composables/useMealSections.js), [../../composables/useTransientSetAnimation.js](../../composables/useTransientSetAnimation.js), [../../composables/useCart.js](../../composables/useCart.js), [../../composables/useAuth.js](../../composables/useAuth.js), [../../composables/useMenuImageCache.js](../../composables/useMenuImageCache.js), [../../storage/menu-etags.js](../../storage/menu-etags.js).

### [MenuItemPage.vue](./MenuItemPage.vue)

- Purpose: the detail view for a selected meal, side, drink, or menu.
- How it works: the component receives `itemData` from the route shell through [../../App.vue](../../App.vue). If that prop is missing, it navigates back to the menu, so this is currently not a classic deep-linkable detail page.
- How it works: for menu-type items it uses the payload's `menuBreakdown` field so the meal/side/drink parts can be opened individually. That feeds back into the parent navigation contract through the `open-item` event.
- How it works: the image is rendered with [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue), so missing or slow images behave the same way they do in the card views.
- How it works: ingredient visibility is controlled by local UI state, while add-to-cart is delegated upward through the `add-to-cart` event instead of being handled inside the page.
- How it works: the back button emits `back`, which [../../App.vue](../../App.vue) translates into navigation to the menu route.
- Main dependencies: [../../App.vue](../../App.vue), [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue), [../../shared/utils.js](../../shared/utils.js), and the payload shape produced by [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js).

### [QuickBuyModal.vue](./QuickBuyModal.vue)

- Purpose: a quick-order modal for users who want to place a single order directly without using the cart.
- How it works: it works from the selected item payload, renders the item name, price, image, and quantity controls, and then sends a direct order request.
- How it works: before ordering it validates that a usable user and a valid orderable item exist. Quantity handling is capped by `MAX_ORDER_QUANTITY` from [../../config/constants.js](../../config/constants.js).
- How it works: the API call goes through `placeOrder` in [../../services/api.js](../../services/api.js), but it is wrapped with the timeout helper from [../../composables/usePromiseTimeout.js](../../composables/usePromiseTimeout.js). That allows the UI to distinguish a slow backend response from a normal request failure.
- How it works: backend payload construction uses shared helper functions from [../../shared/utils.js](../../shared/utils.js), including user and item identifier resolution. The modal therefore does not duplicate order normalization logic.
- How it works: success and error states are handled locally, and the modal is closed through a `close` event. This is intentionally a separate path from the regular cart flow.
- Main dependencies: [../../services/api.js](../../services/api.js), [../../composables/usePromiseTimeout.js](../../composables/usePromiseTimeout.js), [../../config/constants.js](../../config/constants.js), [../../shared/utils.js](../../shared/utils.js), [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue).

### [AboutUs.vue](./AboutUs.vue)

- Purpose: the public informational page that presents the brand, story, values, and team.
- How it works: content does not come from the backend. The component is built entirely from i18n keys and renders locale-derived structures.
- How it works: the team member list is also built from translated data, so language switching naturally re-renders the content without a separate manual mapping layer.
- How it works: it contains no API calls, global store behavior, or route-guard logic. This is a purely content-focused public view.
- Main dependencies: [../../i18n.js](../../i18n.js), [../../locales/hu.json](../../locales/hu.json), [../../locales/en.json](../../locales/en.json).

### [AsyncStatePanel.vue](./AsyncStatePanel.vue)

- Purpose: a small wrapper component for consistent loading, error, and empty-state rendering.
- How it works: it accepts three state props (`isLoading`, `errorText`, `isEmpty`) and picks the rendered branch by priority. If none of those states are active, it renders the default slot.
- How it works: it does not fetch data or interpret errors. The parent passes already-resolved state signals into it.
- Where it is used: currently in multiple list surfaces inside [MenuView.vue](./MenuView.vue).
- Main dependencies: none at the business-logic level.

### [EndpointStatusBadges.vue](./EndpointStatusBadges.vue)

- Purpose: a small diagnostic badge row showing refresh status for the individual menu endpoints.
- How it works: it receives an `items` array and a `statusByKey` object, then renders the current status value for each item. It does not compute status on its own; it only displays it.
- How it works: the component is useful in the developer/debug view of [MenuView.vue](./MenuView.vue), where it should be visible whether a dataset returned `200`, `304`, or an error.
- Main dependencies: none; it is fully prop-driven.

### [FooterSection.vue](./FooterSection.vue)

- Purpose: the public application footer with brand name, contact details, opening hours, and map.
- How it works: most static content comes from translation keys, while the component only computes the current year locally.
- How it works: contact links (`tel:`, `mailto:`) and the Google Maps iframe are hard-coded in the template, so these are currently not admin-configurable data points.
- How it works: even though the file sits in the `public` folder, it is actually used by [../../App.vue](../../App.vue) at the shell level under every non-employee route.
- Main dependencies: [../../App.vue](../../App.vue), [../../i18n.js](../../i18n.js), [../../locales/hu.json](../../locales/hu.json), [../../locales/en.json](../../locales/en.json).

### [MenuAddToCartButton.vue](./MenuAddToCartButton.vue)

- Purpose: the shared “add to cart” CTA used on menu cards.
- How it works: it changes color and icon based on the `count` prop, so the same button can show whether at least one unit of the item is already in the cart.
- How it works: the component does not know cart state itself. It only renders the provided count and label, then emits `add` on click.
- How it works: the `isAnimating` prop enables a CSS `cart-pop` animation. That animation is usually triggered by the parent, especially [MenuView.vue](./MenuView.vue), through [../../composables/useTransientSetAnimation.js](../../composables/useTransientSetAnimation.js).
- Main dependencies: none; it is fully prop- and event-driven.

### [MenuItemCardShell.vue](./MenuItemCardShell.vue)

- Purpose: the shared card frame for public menu items.
- How it works: textual and action content is passed through the default slot, while the image area is standardized through [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue).
- How it works: the entire surface is clickable and emits `open`. That keeps navigation decisions in the parent while the card stays a reusable visual shell.
- How it works: the `group` class lets child elements such as [MenuQuickOrderButton.vue](./MenuQuickOrderButton.vue) react to hover state.
- Main dependencies: [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue).

### [MenuQuickOrderButton.vue](./MenuQuickOrderButton.vue)

- Purpose: the secondary CTA that starts the quick-order flow.
- How it works: it only accepts a label prop and emits `quick-order`. It does not manage a modal and does not talk to the API.
- How it works: on mobile it stays visible, but on larger screens it only appears on hover, which fits the progressive-reveal behavior of the card layout.
- Where it is used: on cards inside [MenuView.vue](./MenuView.vue).
- Main dependencies: none.

### [NotFound.vue](./NotFound.vue)

- Purpose: the catch-all 404 page for unknown public routes.
- How it works: text comes from translations, and the recovery action uses Vue Router to navigate back to the menu route.
- How it works: it has no business logic of its own, but it is an important UX safety net so the user can recover from a dead-end route.
- Main dependencies: [../../router.js](../../router.js), [../../i18n.js](../../i18n.js).

## Supporting Files Worth Reading With This Folder

- [../../App.vue](../../App.vue), because it defines the public route event contract, stores `selectedMenuItem` in session state, and mounts the global `FooterSection`.
- [../../router.js](../../router.js), because it shows which public component is mounted at which URL.
- [../../composables/useMenuData.js](../../composables/useMenuData.js), [../../composables/useMenuCatalogRefresh.js](../../composables/useMenuCatalogRefresh.js), [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js), [../../composables/usePersistedMenuTab.js](../../composables/usePersistedMenuTab.js), and [../../composables/useMealSections.js](../../composables/useMealSections.js), because most of the actual public menu behavior lives there.
- [../../composables/useTransientSetAnimation.js](../../composables/useTransientSetAnimation.js), because it explains the short-lived cart-button animation behavior.
- [../../composables/usePromiseTimeout.js](../../composables/usePromiseTimeout.js), because it explains quick-order timeout handling.
- [../../services/api.js](../../services/api.js), because `QuickBuyModal` places orders directly through it.
- [../../menu/menu-utils.js](../../menu/menu-utils.js) and [../../shared/utils.js](../../shared/utils.js), because several public item/meta/helper behaviors come from those shared helpers.
- [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue), because most image-based public UI depends on it.

## Maintenance Rules

- Keep route-level orchestration in the larger public containers or in composables. Smaller button and shell components should stay simple.
- If a new public screen needs menu item payloads, do not invent a second data shape. Reuse the structure created by [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js).
- If a new state panel is needed, first check whether [AsyncStatePanel.vue](./AsyncStatePanel.vue) can be extended before creating a parallel pattern.
- The current `MenuItemPage` contract is intentionally session-state based. If true deep-link support is needed later, that should be solved across [../../App.vue](../../App.vue), [../../router.js](../../router.js), and the data-loading flow together, not inside the page component alone.