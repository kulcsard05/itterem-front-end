<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
	getCategoriesConditional,
	getDrinksConditional,
	getMealsConditional,
	getMenusConditional,
	getSidesConditional,
} from '../../api.js';
import { asArray, findById, formatCurrency, getItemTypeLabel, getMealIngredientNames, getMealCategoryId, getOrderItemIdKey } from '../../utils.js';

import { getImageSrc, cacheImagesForDatasets, resolveImagePointersForDatasets } from '../../composables/useMenuImageCache.js';
import { useAuth } from '../../composables/useAuth.js';
import { useCart } from '../../composables/useCart.js';
import { useMenuData } from '../../composables/useMenuData.js';
import { useMealSections } from '../../composables/useMealSections.js';
import AsyncStatePanel from './AsyncStatePanel.vue';
import EndpointStatusBadges from './EndpointStatusBadges.vue';
import MenuAddToCartButton from './MenuAddToCartButton.vue';
import MenuItemCardShell from './MenuItemCardShell.vue';
import MenuQuickOrderButton from './MenuQuickOrderButton.vue';
import QuickBuyModal from './QuickBuyModal.vue';

const emit = defineEmits(['open-item', 'add-to-cart']);
const isDev = import.meta.env.DEV;
const { t } = useI18n();

// cartAnimating: true briefly after each click to re-trigger the pop animation.
const cartAnimating = ref(new Set());
const animationTimers = new Map();

const { auth } = useAuth();
const { items: cartItems, rehydrateItems } = useCart();
const {
	categories, meals, sides, menus, drinks,
	setDatasetIfChanged, saveMenuCache, hydrateMenuCache,
} = useMenuData();

const { mealSections } = useMealSections({
	categories,
	meals,
	t,
	getCategoryMeals,
	getCategoryName,
	getMealCategoryId,
});

const datasetRefByType = {
	meals,
	sides,
	menus,
	drinks,
};

const MENU_ACTIVE_TAB_STORAGE_KEY = 'menu-active-tab-v1';
const MENU_TAB_KEYS = ['meals', 'sides', 'menus', 'drinks'];

function readStoredActiveType() {
	try {
		const stored = String(localStorage.getItem(MENU_ACTIVE_TAB_STORAGE_KEY) ?? '').trim();
		return MENU_TAB_KEYS.includes(stored) ? stored : 'meals';
	} catch {
		return 'meals';
	}
}

const cartCountByKey = computed(() => {
	const map = {};
	for (const cartItem of cartItems.value) {
		const key = `${cartItem?.type}-${cartItem?.id}`;
		map[key] = Number(cartItem?.quantity ?? 0) || 0;
	}
	return map;
});

const activeType = ref(readStoredActiveType()); // meals | sides | menus | drinks

watch(activeType, (next) => {
	try {
		localStorage.setItem(MENU_ACTIVE_TAB_STORAGE_KEY, next);
	} catch {
		// ignore storage failures
	}
});

const menuTabs = computed(() => [
	{ key: 'meals', label: t('menu.tabs.meals') },
	{ key: 'sides', label: t('menu.tabs.sides') },
	{ key: 'menus', label: t('menu.tabs.menus') },
	{ key: 'drinks', label: t('menu.tabs.drinks') },
]);

const loading = ref({
	categories: false,
	meals: false,
	sides: false,
	menus: false,
	drinks: false,
});

const errors = ref({
	categories: '',
	meals: '',
	sides: '',
	menus: '',
	drinks: '',
});

const endpointRefreshStatus = ref({
	categories: '-',
	meals: '-',
	sides: '-',
	menus: '-',
	drinks: '-',
});

// True while a background refresh is in flight (data already shown from cache).
const refreshing = ref(false);

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
	return cartAnimating.value.has(cartKey(type, id));
}

function getItemName(type, item) {
	if (!item) return t('common.notAvailable');
	if (type === 'menus') return item?.menuNev ?? t('common.notAvailable');
	return item?.nev ?? t('common.notAvailable');
}

function getCategoryName(cat) {
	return cat?.nev ?? '';
}

function getCategoryMeals(cat) {
	return asArray(cat?.kesziteleks);
}

function toStableTextKey(value) {
	return String(value ?? '').trim().toLowerCase();
}

function getMealListKey(sectionId, item, itemIndex) {
	const id = toStableTextKey(item?.id);
	if (id) return `meal-${sectionId}-${id}`;

	const name = toStableTextKey(item?.nev);
	if (name) return `meal-${sectionId}-name-${name}`;

	return `meal-${sectionId}-fallback-${itemIndex}`;
}

function getSelectedListKey(type, item, itemIndex) {
	const id = toStableTextKey(item?.id);
	if (id) return `${type}-${id}`;

	const name = toStableTextKey(item?.menuNev ?? item?.nev);
	if (name) return `${type}-name-${name}`;

	return `${type}-fallback-${itemIndex}`;
}

function getItemPrice(item) {
	return item?.ar ?? null;
}

function getItemImage(item) {
	return getImageSrc(item?.kep);
}

function getMealIngredientsLabel(meal) {
	const names = getMealIngredientNames(meal);
	return names.length ? names.join(', ') : '';
}

function resolveMenuParts(menu) {
	return {
		meal: findById(meals.value, menu?.keszetelId),
		side: findById(sides.value, menu?.koretId),
		drink: findById(drinks.value, menu?.uditoId),
	};
}

function getMenuMeta(menu) {
	const parts = [];
	const { meal, side, drink } = resolveMenuParts(menu);

	const mealName = String(meal?.nev ?? '').trim();
	const sideName = String(side?.nev ?? '').trim();
	const drinkName = String(drink?.nev ?? '').trim();

	if (mealName) parts.push(mealName);
	if (sideName) parts.push(sideName);
	if (drinkName) parts.push(drinkName);
	return parts.join(' • ');
}

function buildMenuBreakdown(menu) {
	const { meal, side, drink } = resolveMenuParts(menu);

	const mealName = String(meal?.nev ?? '-');
	const sideName = String(side?.nev ?? '-');
	const drinkName = String(drink?.nev ?? '-');

	const mealDescription = String(meal?.leiras ?? '').trim() || '-';
	const sideDescription = String(side?.leiras ?? '').trim() || '-';

	const mealPayload = meal
		? {
			type: 'meals',
			typeLabel: getItemTypeLabel('meals'),
			item: meal,
			id: meal?.id,
			name: mealName,
			description: mealDescription,
			price: meal?.ar ?? null,
			image: getItemImage(meal),
			meta: '',
			menuBreakdown: [],
			ingredients: getMealIngredientNames(meal),
		}
		: null;

	const sidePayload = side
		? {
			type: 'sides',
			typeLabel: getItemTypeLabel('sides'),
			item: side,
			id: side?.id,
			name: sideName,
			description: sideDescription,
			price: side?.ar ?? null,
			image: getItemImage(side),
			meta: '',
			menuBreakdown: [],
			ingredients: [],
		}
		: null;

	const drinkPayload = drink
		? {
			type: 'drinks',
			typeLabel: getItemTypeLabel('drinks'),
			item: drink,
			id: drink?.id,
			name: drinkName,
			description: '',
			price: drink?.ar ?? null,
			image: getItemImage(drink),
			meta: '',
			menuBreakdown: [],
			ingredients: [],
		}
		: null;

	return [
		{
			key: 'meal',
			label: t('itemTypes.meal'),
			name: mealName,
			description: mealDescription,
			openPayload: mealPayload,
		},
		{
			key: 'side',
			label: t('itemTypes.side'),
			name: sideName,
			description: sideDescription,
			openPayload: sidePayload,
		},
		{
			key: 'drink',
			label: t('itemTypes.drink'),
			name: drinkName,
			description: '',
			openPayload: drinkPayload,
		},
	];
}

function getItemDescription(type, item, categoryName = '') {
	const desc = String(item?.leiras ?? '').trim();
	if (desc) return desc;

	if (type === 'menus') {
		return getMenuMeta(item) || t('menu.fallbackMenuItem');
	}

	if (type === 'meals' && categoryName) {
		return t('menu.categoryPrefix', { name: categoryName });
	}

	return t('menu.noDescription');
}

function getCartButtonLabel(type, id) {
	const count = getCartCount(type, id);
	return count ? t('menu.addedCount', { count }) : t('menu.addToCart');
}

function createItemPayload(type, item, categoryName = '') {
	const typeLabel = getItemTypeLabel(type);
	const menuMeal = type === 'menus' ? findById(meals.value, item?.keszetelId) : null;
	const ingredients = type === 'meals'
		? getMealIngredientNames(item)
		: type === 'menus'
			? getMealIngredientNames(menuMeal)
			: [];

	return {
		type,
		typeLabel,
		item,
		name: getItemName(type, item),
		price: getItemPrice(item),
		image: getItemImage(item),
		kep: item?.kep ?? '',
		description: getItemDescription(type, item, categoryName),
		meta: type === 'menus' ? getMenuMeta(item) : categoryName,
		menuBreakdown: type === 'menus' ? buildMenuBreakdown(item) : [],
		ingredients,
	};
}

function openItem(type, item, categoryName = '') {
	emit('open-item', createItemPayload(type, item, categoryName));
}

function quickAddToCart(event, type, item) {
	event.stopPropagation();
	const id = item?.id;
	if (!id || !getOrderItemIdKey(type)) return;
	const typeLabel = getItemTypeLabel(type);
	emit('add-to-cart', {
		type,
		typeLabel,
		id,
		item,
		name: getItemName(type, item),
		price: getItemPrice(item),
		image: getItemImage(item),
		kep: item?.kep ?? '',
	});

	const key = cartKey(type, id);
	const previousTimer = animationTimers.get(key);
	if (previousTimer != null) {
		window.clearTimeout(previousTimer);
		animationTimers.delete(key);
	}
	cartAnimating.value.delete(key);
	requestAnimationFrame(() => {
		cartAnimating.value.add(key);
		const timerId = window.setTimeout(() => {
			cartAnimating.value.delete(key);
			animationTimers.delete(key);
		}, 350);
		animationTimers.set(key, timerId);
	});
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

async function loadOne(key, fn, targetRef, fallbackMessage) {
	loading.value[key] = true;
	errors.value[key] = '';
	endpointRefreshStatus.value[key] = '...';
	try {
		const result = await fn();
		if (result && typeof result === 'object' && 'notModified' in result && result.notModified) {
			endpointRefreshStatus.value[key] = '304';
			return false;
		}

		const data = result && typeof result === 'object' && 'notModified' in result
			? result.data
			: result;

		endpointRefreshStatus.value[key] = '200';
		return setDatasetIfChanged(key, targetRef, data);
	} catch (err) {
		endpointRefreshStatus.value[key] = 'ERR';
		errors.value[key] = err instanceof Error ? err.message : fallbackMessage;
		return false;
	} finally {
		loading.value[key] = false;
	}
}

async function refreshAll() {
	refreshing.value = true;
	try {
		const endpointLoaders = [
			['categories', getCategoriesConditional, categories, t('menu.loadErrors.categories')],
			['meals', getMealsConditional, meals, t('menu.loadErrors.meals')],
			['sides', getSidesConditional, sides, t('menu.loadErrors.sides')],
			['menus', getMenusConditional, menus, t('menu.loadErrors.menus')],
			['drinks', getDrinksConditional, drinks, t('menu.loadErrors.drinks')],
		];

		const changes = await Promise.allSettled([
			...endpointLoaders.map(([key, getter, targetRef, fallback]) => loadOne(key, getter, targetRef, fallback)),
		]);

		const hasChanges = changes.some((entry) => entry.status === 'fulfilled' && entry.value === true);
		if (hasChanges) {
			await saveMenuCache();
		}

		// Re-hydrate cart items with the latest menu data (names, prices, images).
		rehydrateItems();

		// Download and cache any new images in the background.
		// Skips kep values that are already cached — cheap to call every time.
		void cacheImagesForDatasets(categories.value, meals.value, sides.value, menus.value, drinks.value).catch(() => {
			// Image prefetch failures are non-critical for menu rendering.
		});
	} catch {
		errors.value[activeType.value] = t(`menu.loadErrors.${activeType.value}`);
	} finally {
		refreshing.value = false;
	}
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

onUnmounted(() => {
	for (const timerId of animationTimers.values()) {
		window.clearTimeout(timerId);
	}
	animationTimers.clear();
	cartAnimating.value.clear();
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
			<div class="flex flex-wrap items-center gap-2">
				<button
					v-for="tab in menuTabs"
					:key="tab.key"
					type="button"
					class="rounded-full px-3 py-1.5 text-sm font-semibold"
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

			<div class="flex items-center gap-2">
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

							<template v-for="label in [getMealIngredientsLabel(item)]" :key="`meal-ingredients-${item?.id ?? item?.nev ?? 'unknown'}`">
								<p v-if="label" class="mt-1 text-xs text-gray-500">
									{{ label }}
								</p>
							</template>

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
							<template v-for="ingLabel in [getMealIngredientsLabel(findById(meals.value, item?.keszetelId))]" :key="`menu-ingredients-${item?.id ?? item?.menuNev ?? 'unknown'}`">
								<p v-if="activeType === 'menus' && ingLabel" class="mt-1 text-xs text-gray-500">
									{{ ingLabel }}
								</p>
							</template>
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
