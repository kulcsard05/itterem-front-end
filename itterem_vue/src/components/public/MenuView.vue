<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import {
	getCategoriesConditional,
	getDrinksConditional,
	getMealsConditional,
	getMenusConditional,
	getSidesConditional,
	placeOrder,
} from '../../api.js';
import { findById, getItemTypeLabel, getMealIngredientNames, getMealCategoryId, resolveUserId, getOrderItemIdKey } from '../../utils.js';
import { ORDER_TIMEOUT_MS } from '../../constants.js';
import { getImageSrc, cacheImagesForDatasets } from '../../composables/useMenuImageCache.js';
import { useAuth } from '../../composables/useAuth.js';
import { useCart } from '../../composables/useCart.js';
import { useMenuData } from '../../composables/useMenuData.js';

const emit = defineEmits(['open-item', 'add-to-cart']);
const isDev = import.meta.env.DEV;

// cartAnimating: true briefly after each click to re-trigger the pop animation.
const cartAnimating = reactive({});

const { auth } = useAuth();
const { items: cartItems, rehydrateItems } = useCart();
const {
	categories, meals, sides, menus, drinks,
	setDatasetIfChanged, saveMenuCache, hydrateMenuCache,
} = useMenuData();

const cartCountByKey = computed(() => {
	const map = {};
	for (const cartItem of cartItems.value) {
		const key = `${cartItem?.type}-${cartItem?.id}`;
		map[key] = Number(cartItem?.quantity ?? 0) || 0;
	}
	return map;
});

const activeType = ref('meals'); // meals | sides | menus | drinks

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

const endpointDebugItems = computed(() => [
	{ key: 'categories', label: 'Kategóriák' },
	{ key: 'meals', label: 'Készételek' },
	{ key: 'sides', label: 'Köretek' },
	{ key: 'menus', label: 'Menük' },
	{ key: 'drinks', label: 'Üdítők' },
]);

function getItemName(type, item) {
	if (!item) return '-';
	if (type === 'menus') return item?.menuNev ?? '-';
	return item?.nev ?? '-';
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

function getMenuMeta(menu) {
	const parts = [];
	const meal = findById(meals.value, menu?.keszetelId);
	const side = findById(sides.value, menu?.koretId);
	const drink = findById(drinks.value, menu?.uditoId);

	const mealName = String(meal?.nev ?? '').trim();
	const sideName = String(side?.nev ?? '').trim();
	const drinkName = String(drink?.nev ?? '').trim();

	if (mealName) parts.push(mealName);
	if (sideName) parts.push(sideName);
	if (drinkName) parts.push(drinkName);
	return parts.join(' • ');
}

function buildMenuBreakdown(menu) {
	const meal = findById(meals.value, menu?.keszetelId);
	const side = findById(sides.value, menu?.koretId);
	const drink = findById(drinks.value, menu?.uditoId);

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
			label: 'Készétel',
			name: mealName,
			description: mealDescription,
			openPayload: mealPayload,
		},
		{
			key: 'side',
			label: 'Köret',
			name: sideName,
			description: sideDescription,
			openPayload: sidePayload,
		},
		{
			key: 'drink',
			label: 'Üdítő',
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
		return getMenuMeta(item) || 'Menü elem';
	}

	if (type === 'meals' && categoryName) {
		return `Kategória: ${categoryName}`;
	}

	return 'Nincs leírás.';
}

function openItem(type, item, categoryName = '') {
	const typeLabel = getItemTypeLabel(type);
	let ingredients = [];
	if (type === 'meals') {
		ingredients = getMealIngredientNames(item);
	} else if (type === 'menus') {
		const meal = findById(meals.value, item?.keszetelId);
		ingredients = getMealIngredientNames(meal);
	}
	emit('open-item', {
		type,
		typeLabel,
		item,
		name: getItemName(type, item),
		description: getItemDescription(type, item, categoryName),
		price: getItemPrice(item),
		image: getItemImage(item),
		kep: item?.kep ?? '',
		meta: type === 'menus' ? getMenuMeta(item) : categoryName,
		menuBreakdown: type === 'menus' ? buildMenuBreakdown(item) : [],
		ingredients,
	});
}

function quickAddToCart(event, type, item, categoryName = '') {
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

	const key = `${type}-${id}`;
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
const quickBuyQty = ref(1);
const quickBuyOrdering = ref(false);
const quickBuyError = ref('');
const quickBuySuccess = ref(false);
const quickBuySuccessMessage = ref('');

const quickBuyTotal = computed(() => {
	if (!quickBuyItem.value || quickBuyItem.value.price == null) return null;
	return quickBuyItem.value.price * quickBuyQty.value;
});

function openQuickBuy(event, type, item, categoryName = '') {
	event.stopPropagation();
	quickBuyItem.value = {
		type,
		typeLabel: getItemTypeLabel(type),
		item,
		name: getItemName(type, item),
		price: getItemPrice(item),
		image: getItemImage(item),
		kep: item?.kep ?? '',
	};
	quickBuyQty.value = 1;
	quickBuyError.value = '';
	quickBuySuccess.value = false;
	quickBuySuccessMessage.value = '';
	quickBuyOrdering.value = false;
}

function closeQuickBuy() {
	quickBuyItem.value = null;
}

function withQuickBuyTimeout(promise, ms) {
	let timeoutId;
	const timeoutPromise = new Promise((_, reject) => {
		timeoutId = setTimeout(() => {
			reject(new Error('A szerver válasza túl sokáig tartott. Próbáld újra.'));
		}, ms);
	});
	return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

async function confirmQuickBuy() {
	const resolved = resolveUserId(auth.value);
	if (!resolved) {
		quickBuyError.value = 'A rendeléshez be kell jelentkezni.';
		return;
	}
	const data = quickBuyItem.value;
	if (!data) return;
	const idKey = getOrderItemIdKey(data.type);
	if (!idKey) return;

	quickBuyOrdering.value = true;
	quickBuyError.value = '';
	try {
		const payload = [{ [idKey]: data.item?.id, mennyiseg: quickBuyQty.value }];
		const result = await withQuickBuyTimeout(placeOrder(resolved, payload), ORDER_TIMEOUT_MS);
		const apiMessage = typeof result?.message === 'string' ? result.message.trim() : '';
		const orderId = result?.orderId;
		if (apiMessage && orderId != null) {
			quickBuySuccessMessage.value = `${apiMessage} (Rendelés azonosító: ${orderId})`;
		} else if (apiMessage) {
			quickBuySuccessMessage.value = apiMessage;
		} else {
			quickBuySuccessMessage.value = 'Rendelés leadva.';
		}
		quickBuySuccess.value = true;
	} catch (err) {
		quickBuyError.value = err instanceof Error ? err.message : 'Rendelés leadása sikertelen.';
	} finally {
		quickBuyOrdering.value = false;
	}
}

async function loadOne(key, fn, targetRef, fallbackMessage) {
	loading.value[key] = true;
	errors.value[key] = '';
	endpointRefreshStatus.value[key] = '...';
	try {
		const result = await fn();
		if (result && typeof result === 'object' && 'notModified' in result) {
			if (result.notModified) {
				endpointRefreshStatus.value[key] = '304';
				return false;
			}
			endpointRefreshStatus.value[key] = '200';
			return setDatasetIfChanged(key, targetRef, result.data);
		}
		endpointRefreshStatus.value[key] = '200';
		return setDatasetIfChanged(key, targetRef, result);
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
	const changes = await Promise.allSettled([
		loadOne('categories', getCategoriesConditional, categories, 'Kategóriák betöltése sikertelen'),
			loadOne('meals', getMealsConditional, meals, 'Készételek betöltése sikertelen'),
			loadOne('sides', getSidesConditional, sides, 'Köretek betöltése sikertelen'),
			loadOne('menus', getMenusConditional, menus, 'Menük betöltése sikertelen'),
			loadOne('drinks', getDrinksConditional, drinks, 'Üdítők betöltése sikertelen'),
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
	if (activeType.value === 'meals') return meals.value || [];
	if (activeType.value === 'sides') return sides.value || [];
	if (activeType.value === 'menus') return menus.value || [];
	return drinks.value || [];
});

const selectedLoading = computed(() => loading.value[activeType.value]);
const selectedError = computed(() => errors.value[activeType.value]);

const mealSections = computed(() => {
	const cats = Array.isArray(categories.value) ? categories.value : [];
	const ms = Array.isArray(meals.value) ? meals.value : [];
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
				name: getCategoryName(cat) || 'Category',
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
					return [...sectionsFromNestedMeals, { id: 'uncategorized', name: 'Egyéb', meals: extras }];
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
		sections.push({ id: 'uncategorized', name: 'Egyéb', meals: uncategorized });
	}

	return sections;
});
</script>

<template>
	<div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					class="rounded-full px-3 py-1.5 text-sm font-semibold"
					:class="
						activeType === 'meals'
							? 'bg-gray-900 text-white'
							: 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
					"
					@click="activeType = 'meals'"
				>
					Készételek
				</button>
				<button
					type="button"
					class="rounded-full px-3 py-1.5 text-sm font-semibold"
					:class="
						activeType === 'sides'
							? 'bg-gray-900 text-white'
							: 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
					"
					@click="activeType = 'sides'"
				>
					Köretek
				</button>
				<button
					type="button"
					class="rounded-full px-3 py-1.5 text-sm font-semibold"
					:class="
						activeType === 'menus'
							? 'bg-gray-900 text-white'
							: 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
					"
					@click="activeType = 'menus'"
				>
					Menük
				</button>
				<button
					type="button"
					class="rounded-full px-3 py-1.5 text-sm font-semibold"
					:class="
						activeType === 'drinks'
							? 'bg-gray-900 text-white'
							: 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
					"
					@click="activeType = 'drinks'"
				>
					Üdítők
				</button>
			</div>

			<div class="flex items-center gap-2">
				<span
					v-if="refreshing"
					class="text-xs text-gray-400"
				>Frissítés…</span>
				<button
					type="button"
					class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
					:disabled="refreshing"
					@click="refreshAll"
				>
					Refresh
				</button>
			</div>
		</div>

		<div v-if="isDev" class="mt-2 flex flex-wrap gap-2 text-xs">
			<span
				v-for="item in endpointDebugItems"
				:key="item.key"
				class="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-gray-600"
			>
				{{ item.label }}: {{ endpointRefreshStatus[item.key] }}
			</span>
		</div>

		<!-- Meals: grouped by categories -->
		<div v-if="activeType === 'meals'" class="mt-6">
			<!-- Only block with a spinner when there is nothing cached to show yet -->
			<div
				v-if="(loading.meals || loading.categories) && mealSections.length === 0"
				class="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700"
			>
				Készételek betöltése…
			</div>

			<div
				v-else-if="(errors.meals || errors.categories) && mealSections.length === 0"
				class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
			>
				{{ errors.meals || errors.categories }}
			</div>

			<div v-else class="mt-6 space-y-8">
				<div
					v-if="mealSections.length === 0"
					class="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600"
				>
					Nem találhatók készételek.
				</div>

				<section v-for="section in mealSections" :key="section.id">
					<h2 class="text-lg font-bold text-gray-900">{{ section.name }}</h2>

					<div class="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<div
							v-for="item in section.meals"
							:key="item.id"
						class="group cursor-pointer rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-indigo-300"
							@click="openItem('meals', item, section.name)"
						>
							<div class="flex items-stretch justify-between gap-3">
								<div class="flex flex-col justify-between">
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
											{{ getItemPrice(item) }} Ft
										</p>
										<div class="mt-2 flex flex-col items-start gap-1">
											<button
												type="button"
												class="inline-flex items-center gap-1 rounded-md bg-sky-400 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-300 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-150"
												@click.stop="openQuickBuy($event, 'meals', item, section.name)"
											>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4 7h12.8M7 13L5.4 5M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z" />
												</svg>
												Gyors rendelés
											</button>
											<button
												type="button"
											:class="[
												'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-white transition-colors duration-200',
												cartCountByKey[`meals-${item.id}`] ? 'bg-green-500' : 'bg-indigo-600 hover:bg-indigo-500',
												cartAnimating[`meals-${item.id}`] ? 'cart-pop' : '',
											]"
											@click.stop="quickAddToCart($event, 'meals', item, section.name)"
										>
											<svg v-if="cartCountByKey[`meals-${item.id}`]" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
											</svg>
											<span>{{ cartCountByKey[`meals-${item.id}`] ? 'Hozzáadva ' + cartCountByKey[`meals-${item.id}`] + 'x' : '+ Kosár' }}</span>
											</button>
										</div>
									</div>
								</div>
								<img
									v-if="getItemImage(item)"
									:src="getItemImage(item)"
									:alt="item.nev || 'Étel kép'"
									class="h-32 w-32 flex-shrink-0 rounded-lg object-cover"
									loading="lazy"
								/>
							</div>
						</div>
					</div>
				</section>
			</div>
		</div>

		<!-- Other types: flat list -->
		<div v-else class="mt-6">
			<!-- Only block with a spinner when there is nothing cached to show yet -->
			<div v-if="selectedLoading && selectedList.length === 0" class="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
				Betöltés…
			</div>

			<div v-else-if="selectedError && selectedList.length === 0" class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
				{{ selectedError }}
			</div>

			<div v-else>
				<div
					v-if="selectedList.length === 0"
					class="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600"
				>
					Nem találhatók elemek.
				</div>

				<div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<div
						v-for="item in selectedList"
						:key="item.id"
					class="group cursor-pointer rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-indigo-300"
						@click="openItem(activeType, item)"
					>
						<div class="flex items-stretch justify-between gap-3">
							<div class="flex flex-col justify-between">
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
										{{ getItemPrice(item) }} Ft
									</p>
									<div class="mt-2 flex flex-col items-start gap-1">
										<button
											type="button"
											class="inline-flex items-center gap-1 rounded-md bg-sky-400 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-300 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-150"
											@click.stop="openQuickBuy($event, activeType, item)"
										>
											<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4 7h12.8M7 13L5.4 5M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z" />
											</svg>
											Gyors rendelés
										</button>
										<button
											type="button"
											:class="[
												'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-white transition-colors duration-200',
											cartCountByKey[`${activeType}-${item.id}`] ? 'bg-green-500' : 'bg-indigo-600 hover:bg-indigo-500',
											cartAnimating[`${activeType}-${item.id}`] ? 'cart-pop' : '',
										]"
										@click.stop="quickAddToCart($event, activeType, item)"
									>
										<svg v-if="cartCountByKey[`${activeType}-${item.id}`]" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
										</svg>
										<span>{{ cartCountByKey[`${activeType}-${item.id}`] ? 'Hozzáadva ' + cartCountByKey[`${activeType}-${item.id}`] + 'x' : '+ Kosár' }}</span>
										</button>
									</div>
								</div>
							</div>
							<img
								v-if="getItemImage(item)"
								:src="getItemImage(item)"
								:alt="item.nev || 'Étel kép'"
								class="h-32 w-32 flex-shrink-0 rounded-lg object-cover"
								loading="lazy"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Quick-buy confirmation modal -->
	<Teleport to="body">
		<Transition name="qb-fade">
			<div
				v-if="quickBuyItem"
				class="fixed inset-0 z-50 flex items-center justify-center p-4"
				role="dialog"
				aria-modal="true"
				aria-label="Gyors rendelés"
			>
				<!-- Backdrop -->
				<div
					class="absolute inset-0 bg-black/50"
					@click="closeQuickBuy"
				/>

				<!-- Panel -->
				<div class="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl">
					<!-- Header -->
					<div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
						<h2 class="text-base font-semibold text-gray-900">Gyors rendelés</h2>
						<button
							type="button"
							class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
							@click="closeQuickBuy"
							aria-label="Bezárás"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
							</svg>
						</button>
					</div>

					<!-- Success state -->
					<div v-if="quickBuySuccess" class="flex flex-col items-center gap-3 px-6 py-8 text-center">
						<div class="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
							</svg>
						</div>
						<p class="text-base font-semibold text-gray-900">Rendelés leadva!</p>
						<p class="text-sm text-gray-500">{{ quickBuySuccessMessage || 'Köszönjük a rendelést.' }}</p>
						<button
							type="button"
							class="mt-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
							@click="closeQuickBuy"
						>
							Bezárás
						</button>
					</div>

					<!-- Order form -->
					<div v-else class="px-6 py-5 space-y-5">
						<!-- Item info -->
						<div class="flex items-center gap-4">
							<img
								v-if="quickBuyItem.image"
								:src="quickBuyItem.image"
								:alt="quickBuyItem.name"
								class="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
							/>
							<div v-else class="h-20 w-20 flex-shrink-0 rounded-xl bg-gray-100" />
							<div>
								<p class="text-sm text-gray-500">{{ quickBuyItem.typeLabel }}</p>
								<p class="text-base font-semibold text-gray-900 leading-snug">{{ quickBuyItem.name }}</p>
								<p v-if="quickBuyItem.price != null" class="mt-1 text-sm text-gray-500">
									Egységár: <span class="font-medium text-gray-800">{{ quickBuyItem.price }} Ft</span>
								</p>
							</div>
						</div>

						<!-- Quantity -->
						<div class="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
							<span class="text-sm font-medium text-gray-700">Mennyiség</span>
							<div class="flex items-center gap-3">
								<button
									type="button"
									class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
									:disabled="quickBuyQty <= 1"
									@click="quickBuyQty > 1 && quickBuyQty--"
									aria-label="Csökkentés"
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
									</svg>
								</button>
								<span class="w-8 text-center text-base font-bold text-gray-900">{{ quickBuyQty }}</span>
								<button
									type="button"
									class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100"
									@click="quickBuyQty++"
									aria-label="Növelés"
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
									</svg>
								</button>
							</div>
						</div>

						<!-- Total price -->
						<div v-if="quickBuyTotal != null" class="flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3">
							<span class="text-sm font-medium text-indigo-700">Összesen</span>
							<span class="text-xl font-bold text-indigo-700">{{ quickBuyTotal }} Ft</span>
						</div>

						<!-- Error -->
						<p v-if="quickBuyError" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
							{{ quickBuyError }}
						</p>

						<!-- Actions -->
						<div class="flex gap-3 pt-1">
							<button
								type="button"
								class="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
								@click="closeQuickBuy"
							>
								Mégsem
							</button>
							<button
								type="button"
								class="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60"
								:disabled="quickBuyOrdering"
								@click="confirmQuickBuy"
							>
								{{ quickBuyOrdering ? 'Rendelés folyamatban…' : 'Rendelés leadása' }}
							</button>
						</div>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<style scoped>
@keyframes cart-pop {
	0%   { transform: scale(1); }
	35%  { transform: scale(1.18); }
	65%  { transform: scale(0.94); }
	100% { transform: scale(1); }
}

.cart-pop {
	animation: cart-pop 0.3s ease-out forwards;
}

.qb-fade-enter-active,
.qb-fade-leave-active {
	transition: opacity 0.18s ease;
}
.qb-fade-enter-from,
.qb-fade-leave-to {
	opacity: 0;
}
.qb-fade-enter-active .relative,
.qb-fade-leave-active .relative {
	transition: transform 0.18s ease, opacity 0.18s ease;
}
.qb-fade-enter-from .relative,
.qb-fade-leave-to .relative {
	transform: scale(0.95);
	opacity: 0;
}
</style>
