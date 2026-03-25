import { computed } from 'vue';
import { asArray, findById, getItemTypeLabel, getMealIngredientNames } from '../shared/utils.js';
import { getImageSrc } from './useMenuImageCache.js';
import {
	toStableTextKey,
	resolveMenuParts as resolveMenuPartsFromDatasets,
	buildMenuMetaFromParts,
} from '../menu/menu-utils.js';

export function useMenuItemPresentation({ t, meals, sides, drinks }) {
	function getItemName(type, item) {
		if (!item) return t('common.notAvailable');
		if (type === 'menus') return item?.menuNev ?? t('common.notAvailable');
		return item?.nev ?? t('common.notAvailable');
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

	const mealIngredientsById = computed(() => {
		const map = new Map();
		for (const meal of asArray(meals.value)) {
			const id = toStableTextKey(meal?.id);
			if (!id) continue;
			map.set(id, getMealIngredientsLabel(meal));
		}
		return map;
	});

	function getMenuIngredientsLabel(menuItem) {
		const mealId = toStableTextKey(menuItem?.keszetelId);
		if (!mealId) return '';
		return mealIngredientsById.value.get(mealId) ?? '';
	}

	function resolveMenuParts(menu) {
		return resolveMenuPartsFromDatasets({
			menu,
			meals: meals.value,
			sides: sides.value,
			drinks: drinks.value,
		});
	}

	function getMenuMeta(menu) {
		return buildMenuMetaFromParts(resolveMenuParts(menu));
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

	return {
		getItemName,
		getItemPrice,
		getItemImage,
		getMealIngredientsLabel,
		getMenuIngredientsLabel,
		getMenuMeta,
		createItemPayload,
	};
}
