<script setup>
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { asArray, formatCurrency, getMealCategoryId, getOrderItemIdKey } from '../../utils.js';
import {
	getCategoryMeals,
	getCategoryName,
	buildMealListKey as getMealListKey,
	buildSelectedListKey as getSelectedListKey,
} from '../../menu-utils.js';

import { resolveImagePointersForDatasets } from '../../composables/useMenuImageCache.js';
import { useAuth } from '../../composables/useAuth.js';
import { useCart } from '../../composables/useCart.js';
import { useMenuCatalogRefresh } from '../../composables/useMenuCatalogRefresh.js';
import { useMenuData } from '../../composables/useMenuData.js';
import { useMenuItemPresentation } from '../../composables/useMenuItemPresentation.js';
import { usePersistedMenuTab } from '../../composables/usePersistedMenuTab.js';
import { useMealSections } from '../../composables/useMealSections.js';
import { useTransientSetAnimation } from '../../composables/useTransientSetAnimation.js';

const AsyncStatePanel = defineAsyncComponent(() => import('./AsyncStatePanel.vue'));
const EndpointStatusBadges = defineAsyncComponent(() => import('./EndpointStatusBadges.vue'));
const MenuAddToCartButton = defineAsyncComponent(() => import('./MenuAddToCartButton.vue'));
const MenuItemCardShell = defineAsyncComponent(() => import('./MenuItemCardShell.vue'));
const MenuQuickOrderButton = defineAsyncComponent(() => import('./MenuQuickOrderButton.vue'));
const QuickBuyModal = defineAsyncComponent(() => import('./QuickBuyModal.vue'));

const emit = defineEmits(['open-item', 'add-to-cart']);
const isDev = import.meta.env.DEV;
const { t } = useI18n();

// cartAnimating: true briefly after each click to re-trigger the pop animation.
const { isActive: isCartAnimatingKeyActive, trigger: triggerCartAnimation } = useTransientSetAnimation(350);

const { auth } = useAuth();
const { items: cartItems, rehydrateItems } = useCart();
const {
	categories, meals, sides, menus, drinks,
	setDatasetIfChanged, saveMenuCache, hydrateMenuCache,
} = useMenuData();
const {
	getItemName,
	getItemPrice,
	getItemImage,
	getMealIngredientsLabel,
	getMenuIngredientsLabel,
	getMenuMeta,
	createItemPayload,
} = useMenuItemPresentation({
	t,
	meals,
	sides,
	drinks,
});

const { mealSections } = useMealSections({
	categories,
	meals,
	t,
	getMealCategoryId,
});

const datasetRefByType = {
	meals,
	sides,
	menus,
	drinks,
};

const cartCountByKey = computed(() => {
	const map = {};
	for (const cartItem of cartItems.value) {
		const key = `${cartItem?.type}-${cartItem?.id}`;
		map[key] = Number(cartItem?.quantity ?? 0) || 0;
	}
	return map;
});

const { activeType } = usePersistedMenuTab(); // meals | sides | menus | drinks

const menuTabs = computed(() => [
	{ key: 'meals', label: t('menu.tabs.meals') },
	{ key: 'sides', label: t('menu.tabs.sides') },
	{ key: 'menus', label: t('menu.tabs.menus') },
	{ key: 'drinks', label: t('menu.tabs.drinks') },
]);
const {
	loading,
	errors,
	endpointRefreshStatus,
	refreshing,
	refreshAll,
} = useMenuCatalogRefresh({
	t,
	activeType,
	categories,
	meals,
	sides,
	menus,
	drinks,
	setDatasetIfChanged,
	saveMenuCache,
	rehydrateItems,
});

const endpointDebugItems = computed(() => {
	if (!isDev) return [];

	return [{ key: 'categories', label: t('menu.debug.categories') }, ...menuTabs.value];
});

function cartKey(type, id) {
	return `${type}-${id}`;
}

function getCartCount(type, id) {
	return cartCountByKey.value[cartKey(type, id)] ?? 0;
}

function isCartAnimating(type, id) {
	return isCartAnimatingKeyActive(cartKey(type, id));
}

function getCartButtonLabel(type, id) {
	const count = getCartCount(type, id);
	return count ? t('menu.addedCount', { count }) : t('menu.addToCart');
}

function openItem(type, item, categoryName = '') {
	emit('open-item', createItemPayload(type, item, categoryName));
}

function quickAddToCart(event, type, item) {
	event.stopPropagation();
	const id = item?.id;
	if (!id || !getOrderItemIdKey(type)) return;
	const itemPayload = createItemPayload(type, item);
	emit('add-to-cart', {
		type,
		typeLabel: itemPayload.typeLabel,
		id,
		item,
		name: itemPayload.name,
		price: itemPayload.price,
		image: itemPayload.image,
		kep: itemPayload.kep,
	});

	const key = cartKey(type, id);
	triggerCartAnimation(key);
}

// ---------------------------------------------------------------------------
// Quick-buy modal
// ---------------------------------------------------------------------------

const quickBuyItem = ref(null);
const quickBuyRef = ref(null);

function openQuickBuy(event, type, item, categoryName = '') {
	event.stopPropagation();
	quickBuyItem.value = createItemPayload(type, item, categoryName);
	if (quickBuyRef.value?.reset) quickBuyRef.value.reset();
}

function closeQuickBuy() {
	quickBuyItem.value = null;
}

onMounted(() => {
	hydrateMenuCache();
	void resolveImagePointersForDatasets(
		categories.value,
		meals.value,
		sides.value,
		menus.value,
		drinks.value,
	).catch(() => {
		// Keep UI usable even if pointer hydration fails.
	});
	rehydrateItems();
	void refreshAll();
});

const selectedList = computed(() => {
	const source = datasetRefByType[activeType.value];
	return asArray(source?.value);
});

const selectedLoading = computed(() => loading.value[activeType.value]);
const selectedError = computed(() => errors.value[activeType.value]);

const mealsInitialLoading = computed(() =>
	(loading.value.meals || loading.value.categories) && mealSections.value.length === 0,
);

const mealsInitialError = computed(() => {
	if (mealSections.value.length > 0) return '';
	return errors.value.meals || errors.value.categories || '';
});

const mealsIsEmpty = computed(() => mealSections.value.length === 0);

const selectedInitialLoading = computed(() => selectedLoading.value && selectedList.value.length === 0);
const selectedInitialError = computed(() => (selectedList.value.length === 0 ? selectedError.value : ''));
const selectedIsEmpty = computed(() => selectedList.value.length === 0);

</script>

<template>
	<div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4">
				<button
					v-for="tab in menuTabs"
					:key="tab.key"
					type="button"
					class="min-h-10 w-full rounded-full px-3.5 py-2 text-sm font-semibold"
					:class="
						activeType === tab.key
							? 'bg-gray-900 text-white'
							: 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
					"
					@click="activeType = tab.key"
				>
					{{ tab.label }}
				</button>
			</div>

			<div v-if="isDev" class="flex items-center gap-2">
				<span
					v-if="refreshing"
					class="text-xs text-gray-400"
				>{{ t('common.refreshing') }}</span>
				<button
					type="button"
					class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
					:disabled="refreshing"
					@click="refreshAll"
				>
					{{ t('common.refresh') }}
				</button>
			</div>
		</div>

		<EndpointStatusBadges :items="endpointDebugItems" :status-by-key="endpointRefreshStatus" />

		<!-- Meals: grouped by categories -->
		<div v-if="activeType === 'meals'" class="mt-6">
			<AsyncStatePanel
				:is-loading="mealsInitialLoading"
				:error-text="mealsInitialError"
				:is-empty="mealsIsEmpty"
				:loading-label="t('menu.loadingMeals')"
				:empty-label="t('menu.emptyMeals')"
			>
				<div class="mt-6 space-y-8">
					<section v-for="section in mealSections" :key="section.id">
					<h2 class="text-lg font-bold text-gray-900">{{ section.name }}</h2>

					<div class="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<MenuItemCardShell
							v-for="(item, itemIndex) in section.meals"
							:key="getMealListKey(section.id, item, itemIndex)"
							:image-src="getItemImage(item)"
							:image-alt="item.nev || t('menu.alt.foodImage')"
							@open="openItem('meals', item, section.name)"
						>
							<h3 class="text-base font-semibold text-gray-900">{{ item.nev }}</h3>
							<p v-if="getMealIngredientsLabel(item)" class="mt-1 text-xs text-gray-500">
								{{ getMealIngredientsLabel(item) }}
							</p>

							<div>
								<p
									v-if="getItemPrice(item) != null"
									class="mt-auto text-sm font-medium text-gray-700"
								>
									{{ formatCurrency(getItemPrice(item)) }}
								</p>
								<div class="mt-2 flex flex-col items-start gap-1">
									<MenuQuickOrderButton
										:label="t('menu.quickOrder')"
										@quick-order.stop="openQuickBuy($event, 'meals', item, section.name)"
									/>
									<MenuAddToCartButton
										:count="getCartCount('meals', item.id)"
										:is-animating="isCartAnimating('meals', item.id)"
										:label="getCartButtonLabel('meals', item.id)"
										@add.stop="quickAddToCart($event, 'meals', item)"
									/>
								</div>
							</div>
						</MenuItemCardShell>
					</div>
					</section>
				</div>
			</AsyncStatePanel>
		</div>

		<!-- Other types: flat list -->
		<div v-else class="mt-6">
			<AsyncStatePanel
				:is-loading="selectedInitialLoading"
				:error-text="selectedInitialError"
				:is-empty="selectedIsEmpty"
				:loading-label="t('menu.loadingGeneric')"
				:empty-label="t('menu.emptyGeneric')"
			>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<MenuItemCardShell
						v-for="(item, itemIndex) in selectedList"
						:key="getSelectedListKey(activeType, item, itemIndex)"
						:image-src="getItemImage(item)"
						:image-alt="item.nev || t('menu.alt.foodImage')"
						@open="openItem(activeType, item)"
					>
						<h3 class="text-base font-semibold text-gray-900">
							{{ getItemName(activeType, item) }}
						</h3>

						<div>
							<p v-if="activeType === 'menus' && getMenuMeta(item)" class="text-xs text-gray-500">
								{{ getMenuMeta(item) }}
							</p>
							<p v-if="activeType === 'menus' && getMenuIngredientsLabel(item)" class="mt-1 text-xs text-gray-500">
								{{ getMenuIngredientsLabel(item) }}
							</p>
							<p
								v-if="getItemPrice(item) != null"
								class="mt-auto text-sm font-medium text-gray-700"
							>
								{{ formatCurrency(getItemPrice(item)) }}
							</p>
							<div class="mt-2 flex flex-col items-start gap-1">
								<MenuQuickOrderButton
									:label="t('menu.quickOrder')"
									@quick-order.stop="openQuickBuy($event, activeType, item)"
								/>
								<MenuAddToCartButton
									:count="getCartCount(activeType, item.id)"
									:is-animating="isCartAnimating(activeType, item.id)"
									:label="getCartButtonLabel(activeType, item.id)"
									@add.stop="quickAddToCart($event, activeType, item)"
								/>
							</div>
						</div>
					</MenuItemCardShell>
				</div>
			</AsyncStatePanel>
		</div>
	</div>

	<!-- Quick-buy confirmation modal -->
	<QuickBuyModal
		ref="quickBuyRef"
		:item="quickBuyItem"
		:auth="auth"
		@close="closeQuickBuy"
	/>
</template>
