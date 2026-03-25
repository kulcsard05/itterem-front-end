import { asArray, findById } from '../shared/utils.js';

export function toStableTextKey(value) {
	return String(value ?? '').trim().toLowerCase();
}

export function getCategoryName(category) {
	return category?.nev ?? '';
}

export function getCategoryMeals(category) {
	return asArray(category?.kesziteleks);
}

export function buildMealListKey(sectionId, item, itemIndex) {
	const id = toStableTextKey(item?.id);
	if (id) return `meal-${sectionId}-${id}`;

	const name = toStableTextKey(item?.nev);
	if (name) return `meal-${sectionId}-name-${name}`;

	return `meal-${sectionId}-fallback-${itemIndex}`;
}

export function buildSelectedListKey(type, item, itemIndex) {
	const id = toStableTextKey(item?.id);
	if (id) return `${type}-${id}`;

	const name = toStableTextKey(item?.menuNev ?? item?.nev);
	if (name) return `${type}-name-${name}`;

	return `${type}-fallback-${itemIndex}`;
}

export function resolveMenuParts({ menu, meals, sides, drinks }) {
	return {
		meal: findById(meals, menu?.keszetelId),
		side: findById(sides, menu?.koretId),
		drink: findById(drinks, menu?.uditoId),
	};
}

export function buildMenuMetaFromParts({ meal, side, drink }) {
	const parts = [];

	const mealName = String(meal?.nev ?? '').trim();
	const sideName = String(side?.nev ?? '').trim();
	const drinkName = String(drink?.nev ?? '').trim();

	if (mealName) parts.push(mealName);
	if (sideName) parts.push(sideName);
	if (drinkName) parts.push(drinkName);

	return parts.join(' • ');
}
