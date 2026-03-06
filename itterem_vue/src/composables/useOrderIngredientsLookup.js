import { computed } from 'vue';
import { getMealIngredientNames } from '../utils.js';

export function useOrderIngredientsLookup({ meals, menus, findById }) {
	// Memoized lookup maps for O(1) access by name.
	const mealsByName = computed(() => {
		const map = new Map();
		for (const m of (Array.isArray(meals.value) ? meals.value : [])) {
			const name = String(m?.nev ?? '').trim();
			if (name) map.set(name, m);
		}
		return map;
	});

	const menusByName = computed(() => {
		const map = new Map();
		for (const m of (Array.isArray(menus.value) ? menus.value : [])) {
			const name = String(m?.menuNev ?? '').trim();
			if (name) map.set(name, m);
		}
		return map;
	});

	function getOrderEntryIngredients(entry) {
		if (!entry || typeof entry !== 'object') return [];

		const mealId = entry?.keszetelId ?? entry?.keszetel?.id ?? null;
		if (mealId != null) {
			const meal = findById(meals.value, mealId);
			return getMealIngredientNames(meal);
		}

		const menuId = entry?.menuId ?? entry?.menu?.id ?? null;
		if (menuId != null) {
			const menu = findById(menus.value, menuId);
			const menuMealId = menu?.keszetelId ?? null;
			if (menuMealId != null) {
				const meal = findById(meals.value, menuMealId);
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
				const meal = findById(meals.value, menuMealId);
				return getMealIngredientNames(meal);
			}
		}

		return [];
	}

	return {
		getOrderEntryIngredients,
	};
}
