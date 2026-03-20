import { asArray } from '../../utils.js';

export const AVAILABLE_OPTIONS = Object.freeze([
	{ value: 1, label: 'Igen' },
	{ value: 0, label: 'Nem' },
]);

export function getMenuMealId(menu) {
	return menu?.keszetelId ?? null;
}

export function getMenuSideId(menu) {
	return menu?.koretId ?? null;
}

export function getMenuDrinkId(menu) {
	return menu?.uditoId ?? null;
}

export function toStringList(values) {
	return asArray(values)
		.map((value) => String(value).trim())
		.filter(Boolean);
}
