import { createCategoryConfig } from './categoryConfig.js';
import { createDrinkConfig } from './drinkConfig.js';
import { createIngredientConfig } from './ingredientConfig.js';
import { createMealConfig } from './mealConfig.js';
import { createMenuConfig } from './menuConfig.js';
import { createOrderConfig } from './orderConfig.js';
import { createSideConfig } from './sideConfig.js';

export function buildEntityConfigs({ kategoriak, hozzavalok, keszetelek, koretek, uditok }) {
	return {
		ingredient: createIngredientConfig(),
		category: createCategoryConfig(),
		meal: createMealConfig({ kategoriak, hozzavalok }),
		side: createSideConfig(),
		drink: createDrinkConfig(),
		menu: createMenuConfig({ keszetelek, koretek, uditok }),
		order: createOrderConfig(),
	};
}
