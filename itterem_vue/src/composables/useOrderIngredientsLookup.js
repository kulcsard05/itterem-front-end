import { getMealIngredientNames } from '../utils.js';

export function useOrderIngredientsLookup({ meals, menus, findById }) {
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
			const meal =
				(Array.isArray(meals.value) ? meals.value : []).find((m) => String(m?.nev ?? '').trim() === mealName) ??
				null;
			return getMealIngredientNames(meal);
		}

		const menuName = String(entry?.menuNev ?? '').trim();
		if (menuName) {
			const menu =
				(Array.isArray(menus.value) ? menus.value : []).find((m) => String(m?.menuNev ?? '').trim() === menuName) ??
				null;
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
