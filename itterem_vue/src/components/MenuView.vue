<script setup>
import { computed, onMounted, ref } from 'vue';
import { getCategories, getDrinks, getMeals, getMenus, getSides } from '../api.js';
import { findByIdOrName, getItemTypeLabel, toImageSrc } from '../utils.js';

const emit = defineEmits(['open-item', 'add-to-cart']);

const activeType = ref('meals'); // meals | sides | menus | drinks

const categories = ref([]);
const meals = ref([]);
const sides = ref([]);
const menus = ref([]);
const drinks = ref([]);

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

function getMealCategoryId(meal) {
	const value = meal?.kategoriaId ?? null;
	return value == null ? null : String(value);
}

function getCategoryName(cat) {
	return cat?.nev ?? '';
}

function getCategoryMeals(cat) {
	const value = cat?.kesziteleks ?? [];
	return Array.isArray(value) ? value : [];
}

function getItemName(type, item) {
	if (!item) return '-';
	if (type === 'menus') return item?.menuNev ?? '-';
	return item?.nev ?? '-';
}

function getItemPrice(item) {
	return item?.ar ?? null;
}

function getItemImage(item) {
	return toImageSrc(item?.kep);
}

function getMenuMeta(menu) {
	const parts = [];
	const meal = menu?.keszetelNev;
	const side = menu?.koretNev;
	const drink = menu?.uditoNev;
	if (meal) parts.push(String(meal));
	if (side) parts.push(String(side));
	if (drink) parts.push(String(drink));
	return parts.join(' • ');
}

function buildMenuBreakdown(menu) {
	const meal = findByIdOrName(meals.value, menu?.keszetelId, menu?.keszetelNev);
	const side = findByIdOrName(sides.value, menu?.koretId, menu?.koretNev);

	const mealName = String(menu?.keszetelNev ?? meal?.nev ?? '-');
	const sideName = String(menu?.koretNev ?? side?.nev ?? '-');
	const drinkName = String(menu?.uditoNev ?? '-');

	const mealDescription = String(meal?.leiras ?? '').trim() || '-';
	const sideDescription = String(side?.leiras ?? '').trim() || '-';

	return [
		{
			key: 'meal',
			label: 'Készétel',
			name: mealName,
			description: mealDescription,
		},
		{
			key: 'side',
			label: 'Köret',
			name: sideName,
			description: sideDescription,
		},
		{
			key: 'drink',
			label: 'Üditő',
			name: drinkName,
			description: '',
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
	emit('open-item', {
		type,
		typeLabel: getItemTypeLabel(type),
		item,
		name: getItemName(type, item),
		description: getItemDescription(type, item, categoryName),
		price: getItemPrice(item),
		image: getItemImage(item),
		meta: type === 'menus' ? getMenuMeta(item) : categoryName,
		menuBreakdown: type === 'menus' ? buildMenuBreakdown(item) : [],
	});
}

function quickAddToCart(event, type, item, categoryName = '') {
	event.stopPropagation();
	emit('add-to-cart', {
		type,
		typeLabel: getItemTypeLabel(type),
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
	try {
		const result = await fn();
		targetRef.value = Array.isArray(result) ? result : [];
	} catch (err) {
		targetRef.value = [];
		errors.value[key] = err instanceof Error ? err.message : fallbackMessage;
	} finally {
		loading.value[key] = false;
	}
}

async function refreshAll() {
	await Promise.allSettled([
		loadOne('categories', getCategories, categories, 'Kategóriák betöltése sikertelen'),
			loadOne('meals', getMeals, meals, 'Készételek betöltése sikertelen'),
			loadOne('sides', getSides, sides, 'Köretek betöltése sikertelen'),
			loadOne('menus', getMenus, menus, 'Menük betöltése sikertelen'),
			loadOne('drinks', getDrinks, drinks, 'Üditők betöltése sikertelen'),
	]);
}

onMounted(() => {
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
					Üditők
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
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
