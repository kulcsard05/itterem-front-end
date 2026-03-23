import { computed } from 'vue';
import { asArray } from '../utils.js';
import {
	getCategoryMeals as getCategoryMealsDefault,
	getCategoryName as getCategoryNameDefault,
} from '../menu-utils.js';

export function useMealSections({
	categories,
	meals,
	t,
	getCategoryMeals = getCategoryMealsDefault,
	getCategoryName = getCategoryNameDefault,
	getMealCategoryId,
}) {
	const mealSections = computed(() => {
		const cats = asArray(categories.value);
		const ms = asArray(meals.value);

		if (cats.length === 0 && ms.length > 0) {
			return [{ id: 'uncategorized', name: t('common.uncategorized'), meals: ms }];
		}

		const mealsById = new Map(ms.map((meal) => [String(meal?.id), meal]));

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

	return { mealSections };
}
