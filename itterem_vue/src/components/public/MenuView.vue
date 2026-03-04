<script setup>
import { computed, onMounted, ref } from 'vue';
import {
	getCategoriesConditional,
	getDrinksConditional,
	getMealsConditional,
	getMenusConditional,
	getSidesConditional,
} from '../../api.js';
import { findById, getItemTypeLabel, getMealIngredientNames, getMealCategoryId, toImageSrc } from '../../utils.js';
import { MENU_CACHE_STORAGE_KEY } from '../../constants.js';

const emit = defineEmits(['open-item', 'add-to-cart']);
const isDev = import.meta.env.DEV;

const activeType = ref('meals'); // meals | sides | menus | drinks

const categories = ref([]);
const meals = ref([]);
const sides = ref([]);
const menus = ref([]);
const drinks = ref([]);

const menuFingerprints = ref({
	categories: '',
	meals: '',
	sides: '',
	menus: '',
	drinks: '',
});

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
	return toImageSrc(item?.kep);
}

function toDatasetFingerprint(value) {
	const list = Array.isArray(value) ? value : [];
	try {
		return JSON.stringify(list);
	} catch {
		return String(list.length);
	}
}

function setDatasetIfChanged(key, targetRef, value) {
	const nextList = Array.isArray(value) ? value : [];
	const nextFingerprint = toDatasetFingerprint(nextList);
	if (menuFingerprints.value[key] === nextFingerprint) return false;
	targetRef.value = nextList;
	menuFingerprints.value[key] = nextFingerprint;
	return true;
}

function saveMenuCache() {
	try {
		const payload = {
			categories: categories.value,
			meals: meals.value,
			sides: sides.value,
			menus: menus.value,
			drinks: drinks.value,
		};
		localStorage.setItem(MENU_CACHE_STORAGE_KEY, JSON.stringify(payload));
	} catch {
		// ignore cache write failures (private mode, quota, etc.)
	}
}

function hydrateMenuCache() {
	try {
		const raw = localStorage.getItem(MENU_CACHE_STORAGE_KEY);
		if (!raw) return;
		const payload = JSON.parse(raw);
		if (!payload || typeof payload !== 'object') return;
		setDatasetIfChanged('categories', categories, payload.categories);
		setDatasetIfChanged('meals', meals, payload.meals);
		setDatasetIfChanged('sides', sides, payload.sides);
		setDatasetIfChanged('menus', menus, payload.menus);
		setDatasetIfChanged('drinks', drinks, payload.drinks);
	} catch {
		// ignore cache parse errors
	}
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
		meta: type === 'menus' ? getMenuMeta(item) : categoryName,
		menuBreakdown: type === 'menus' ? buildMenuBreakdown(item) : [],
		ingredients,
	});
}

function quickAddToCart(event, type, item, categoryName = '') {
	event.stopPropagation();
	const typeLabel = getItemTypeLabel(type);
	emit('add-to-cart', {
		type,
		typeLabel,
		id: item?.id,
		item,
		name: getItemName(type, item),
		price: getItemPrice(item),
		image: getItemImage(item),
	});
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
	const changes = await Promise.allSettled([
		loadOne('categories', getCategoriesConditional, categories, 'Kategóriák betöltése sikertelen'),
			loadOne('meals', getMealsConditional, meals, 'Készételek betöltése sikertelen'),
			loadOne('sides', getSidesConditional, sides, 'Köretek betöltése sikertelen'),
			loadOne('menus', getMenusConditional, menus, 'Menük betöltése sikertelen'),
			loadOne('drinks', getDrinksConditional, drinks, 'Üdítők betöltése sikertelen'),
	]);

	const hasChanges = changes.some((entry) => entry.status === 'fulfilled' && entry.value === true);
	if (hasChanges) saveMenuCache();
}

onMounted(() => {
	hydrateMenuCache();
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

			<button
				type="button"
				class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
				@click="refreshAll"
			>
				Refresh
			</button>
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
			<div
				v-if="loading.meals || loading.categories"
				class="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700"
			>
				Készételek betöltése…
			</div>

			<div
				v-else-if="errors.meals || errors.categories"
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
							class="cursor-pointer rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-indigo-300"
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
										<button
											type="button"
											class="mt-2 inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
											@click.stop="quickAddToCart($event, 'meals', item, section.name)"
										>
											+ Kosár
										</button>
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
			<div v-if="selectedLoading" class="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
				Betöltés…
			</div>

			<div v-else-if="selectedError" class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
						class="cursor-pointer rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-indigo-300"
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
									<button
										type="button"
										class="mt-2 inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
										@click.stop="quickAddToCart($event, activeType, item)"
									>
										+ Kosár
									</button>
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
</template>
