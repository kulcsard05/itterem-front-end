<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
	getCategories,
	getCategoriesConditional,
	getDrinks,
	getDrinksConditional,
	getMeals,
	getMealsConditional,
	getMenus,
	getMenusConditional,
	getSides,
	getSidesConditional,
} from '../../api.js';
import { findById, formatCurrency, getItemTypeLabel, getMealIngredientNames, getMealCategoryId, getOrderItemIdKey } from '../../utils.js';

import { getImageSrc, cacheImagesForDatasets } from '../../composables/useMenuImageCache.js';
import { useAuth } from '../../composables/useAuth.js';
import { useCart } from '../../composables/useCart.js';
import { useMenuData } from '../../composables/useMenuData.js';
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
const cartAnimating = reactive({});

const { auth } = useAuth();
const { items: cartItems, rehydrateItems } = useCart();
const {
	categories, meals, sides, menus, drinks,
	setDatasetIfChanged, saveMenuCache, hydrateMenuCache,
} = useMenuData();

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
	return Boolean(cartAnimating[cartKey(type, id)]);
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
	const value = cat?.kesziteleks ?? [];
	return Array.isArray(value) ? value : [];
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
	// Re-trigger animation on every click by removing then re-adding the flag.
	delete cartAnimating[key];
	requestAnimationFrame(() => {
		cartAnimating[key] = true;
		setTimeout(() => { delete cartAnimating[key]; }, 350);
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
	if (hasChanges) saveMenuCache();

	// Re-hydrate cart items with the latest menu data (names, prices, images).
	rehydrateItems();

	// Download and cache any new images in the background.
	// Skips kep values that are already cached — cheap to call every time.
	cacheImagesForDatasets(categories.value, meals.value, sides.value, menus.value, drinks.value);
	refreshing.value = false;
}

onMounted(() => {
	hydrateMenuCache();
	rehydrateItems();
	refreshAll();
});

const selectedList = computed(() => {
	const source = datasetRefByType[activeType.value];
	return Array.isArray(source?.value) ? source.value : [];
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

const mealSections = computed(() => {
	const cats = Array.isArray(categories.value) ? categories.value : [];
	const ms = Array.isArray(meals.value) ? meals.value : [];

	if (cats.length === 0 && ms.length > 0) {
		return [{ id: 'uncategorized', name: t('common.uncategorized'), meals: ms }];
	}

	const mealsById = new Map(ms.map((meal) => [String(meal?.id), meal]));

	// Preferred: backend returns categories with nested meals, e.g.
	// [{ nev: 'Hamburgerek', kesziteleks: [...] }, ...]
	const sectionsFromNestedMeals = cats
		.map((cat, index) => {
			const list = getCategoryMeals(cat).map((meal) => {
				const id = meal?.id;
				if (id == null) return meal;

				const fullMeal = mealsById.get(String(id));
				if (!fullMeal) return meal;

				return {
					...fullMeal,
					...meal,
					ar: meal?.ar ?? fullMeal?.ar,
					kep: meal?.kep ?? fullMeal?.kep,
					nev: meal?.nev ?? fullMeal?.nev,
				};
			});
			const id = cat?.id ?? String(index);
			return {
				id: String(id),
				name: getCategoryName(cat) || t('common.uncategorized'),
				meals: list,
			};
		})
		.filter((s) => s.meals.length > 0);

	if (sectionsFromNestedMeals.length > 0) {
		const usedMealIds = new Set();
		for (const section of sectionsFromNestedMeals) {
			for (const meal of section.meals) {
				if (meal?.id != null) usedMealIds.add(String(meal.id));
			}
		}

		const extras = ms.filter((meal) => {
			const id = meal?.id != null ? String(meal.id) : '';
			if (id && usedMealIds.has(id)) return false;
			return !getMealCategoryId(meal);
		});

		if (extras.length > 0) {
					return [...sectionsFromNestedMeals, { id: 'uncategorized', name: t('common.uncategorized'), meals: extras }];
		}

		return sectionsFromNestedMeals;
	}

	const mealsByCat = new Map();
	const uncategorized = [];

	for (const meal of ms) {
		const catId = getMealCategoryId(meal);
		if (!catId) {
			uncategorized.push(meal);
			continue;
		}
		if (!mealsByCat.has(catId)) mealsByCat.set(catId, []);
		mealsByCat.get(catId).push(meal);
	}

	const sections = cats
		.map((cat) => {
			const id = cat?.id != null ? String(cat.id) : null;
			const list = id ? mealsByCat.get(id) || [] : [];
			return {
				id: id ?? getCategoryName(cat),
				name: getCategoryName(cat),
				meals: list,
			};
		})
		.filter((s) => s.meals.length > 0);

	if (uncategorized.length > 0) {
		sections.push({ id: 'uncategorized', name: t('common.uncategorized'), meals: uncategorized });
	}

	return sections;
});
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
							v-for="item in section.meals"
							:key="item.id"
							:image-src="getItemImage(item)"
							:image-alt="item.nev || t('menu.alt.foodImage')"
							@open="openItem('meals', item, section.name)"
						>
							<h3 class="text-base font-semibold text-gray-900">{{ item.nev }}</h3>

							<template v-for="label in [getMealIngredientsLabel(item)]" :key="0">
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
						v-for="item in selectedList"
						:key="item.id"
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
							<template v-for="ingLabel in [getMealIngredientsLabel(findById(meals, item?.keszetelId))]" :key="0">
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
