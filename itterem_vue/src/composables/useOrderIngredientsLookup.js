import { computed } from 'vue';
import { asArray, getMealIngredientNames } from '../utils.js';

export function useOrderIngredientsLookup({ meals, menus, findById }) {
	const mealsById = computed(() => {
		const map = new Map();
		for (const meal of asArray(meals.value)) {
			const id = meal?.id;
			if (id == null) continue;
			map.set(String(id), meal);
		}
		return map;
	});

	const menusById = computed(() => {
		const map = new Map();
		for (const menu of asArray(menus.value)) {
			const id = menu?.id;
			if (id == null) continue;
			map.set(String(id), menu);
		}
		return map;
	});

	// Memoized lookup maps for O(1) access by name.
	const mealsByName = computed(() => {
		const map = new Map();
		for (const m of asArray(meals.value)) {
			const name = String(m?.nev ?? '').trim();
			if (name) map.set(name, m);
		}
		return map;
	});

	function resolveMealById(id) {
		if (id == null) return null;
		const byMap = mealsById.value.get(String(id));
		if (byMap) return byMap;
		if (typeof findById === 'function') return findById(meals.value, id);
		return null;
	}

	function resolveMenuById(id) {
		if (id == null) return null;
		const byMap = menusById.value.get(String(id));
		if (byMap) return byMap;
		if (typeof findById === 'function') return findById(menus.value, id);
		return null;
	}

	const menusByName = computed(() => {
		const map = new Map();
		for (const m of asArray(menus.value)) {
			const name = String(m?.menuNev ?? '').trim();
			if (name) map.set(name, m);
		}
		return map;
	});

	function getOrderEntryIngredients(entry) {
		if (!entry || typeof entry !== 'object') return [];

		const mealId = entry?.keszetelId ?? entry?.keszetel?.id ?? null;
		if (mealId != null) {
			const meal = resolveMealById(mealId);
			return getMealIngredientNames(meal);
		}

		const menuId = entry?.menuId ?? entry?.menu?.id ?? null;
		if (menuId != null) {
			const menu = resolveMenuById(menuId);
			const menuMealId = menu?.keszetelId ?? null;
			if (menuMealId != null) {
				const meal = resolveMealById(menuMealId);
				return getMealIngredientNames(meal);
			}
		}

		const mealName = String(entry?.keszetelNev ?? '').trim();
		if (mealName) {
			return getMealIngredientNames(mealsByName.value.get(mealName) ?? null);
		}

		const menuName = String(entry?.menuNev ?? '').trim();
		if (menuName) {
			const menu = menusByName.value.get(menuName) ?? null;
			const menuMealId = menu?.keszetelId ?? null;
			if (menuMealId != null) {
				const meal = resolveMealById(menuMealId);
				return getMealIngredientNames(meal);
			}
		}

		return [];
	}

	return {
		getOrderEntryIngredients,
	};
}
