import { createMenu, deleteMenu, updateMenu } from '../../api.js';
import {
	buildElerheto,
	buildSelectOptions,
	normalizeAvailable,
	normalizePriceValue,
	normalizeSelectValue,
	parsePrice,
	requiredAtLeastOneSelect,
	requiredImageOnCreate,
	requiredName,
	requiredPrice,
	validateAll,
	formatPrice,
} from '../../admin-helpers.js';
import { getImageSrcFromItem } from '../../utils.js';
import {
	AVAILABLE_OPTIONS,
	getMenuDrinkId,
	getMenuMealId,
	getMenuSideId,
} from './shared.js';

function toNullableId(value) {
	const trimmed = String(value ?? '').trim();
	return trimmed === '' ? null : trimmed;
}

export function createMenuConfig({ keszetelek, koretek, uditok }) {
	return {
		label: 'Menü',
		tableTitle: 'Menük Kezelése',
		addLabel: '+ Új menü',
		hasImage: true,
		bulk: { canDelete: true, supportsAvailability: true, supportsPrice: true, supportsStatus: false },
		api: { create: createMenu, update: updateMenu, delete: deleteMenu },
		columns: [
			{ key: 'id', label: 'ID' },
			{ key: 'menuDisplayName', label: 'Menü Név', bold: true },
			{ key: 'keszetel', label: 'Készétel' },
			{ key: 'koret', label: 'Köret' },
			{ key: 'udito', label: 'Üdítő' },
			{ key: 'ar', label: 'Ár', format: (item) => formatPrice(item.ar) },
			{ key: 'elerheto', label: 'Elérhető', type: 'available' },
		],
		formFields: [
			{ key: 'menuNev', label: 'Menü név', type: 'text' },
			{
				key: 'keszetelId',
				label: 'Készétel',
				type: 'select',
				placeholder: 'Válassz készételt',
				options: () => buildSelectOptions(keszetelek.value),
			},
			{
				key: 'koretId',
				label: 'Köret',
				type: 'select',
				placeholder: 'Válassz köretet',
				options: () => buildSelectOptions(koretek.value),
			},
			{
				key: 'uditoId',
				label: 'Üdítő',
				type: 'select',
				placeholder: 'Nincs ital',
				helpText: 'A "Nincs ital" (NULL) az alapértelmezett.',
				options: () => buildSelectOptions(uditok.value),
			},
			{ key: 'elerheto', label: 'Elérhető', type: 'select', options: AVAILABLE_OPTIONS },
			{ key: 'ar', label: 'Ár (Ft)', type: 'number', min: 0, step: 1 },
		],
		mapItemToForm: (item) => ({
			id: item?.id,
			menuNev: String(item?.menuNev ?? ''),
			keszetelId: normalizeSelectValue(getMenuMealId(item)),
			koretId: normalizeSelectValue(getMenuSideId(item)),
			uditoId: normalizeSelectValue(getMenuDrinkId(item)),
			elerheto: normalizeAvailable(item?.elerheto) ? 1 : 0,
			ar: normalizePriceValue(item?.ar),
			kepFile: null,
			currentImageUrl: getImageSrcFromItem(item, 'kep'),
		}),
		defaultForm: () => ({
			menuNev: '',
			keszetelId: '',
			koretId: '',
			uditoId: '',
			elerheto: 1,
			ar: '',
			kepFile: null,
			currentImageUrl: '',
		}),
		validate: (form, isCreate) =>
			validateAll(
				[
					(currentForm) => requiredName(currentForm, 'menuNev', 'Menü név'),
					(currentForm) => requiredAtLeastOneSelect(currentForm, ['keszetelId', 'koretId'], 'Készétel vagy Köret'),
					(currentForm) => requiredPrice(currentForm),
					(currentForm, createMode) => requiredImageOnCreate(currentForm, createMode),
				],
				form,
				isCreate,
			),
		buildPayload: (form, isCreate) => {
			const base = {
				menuNev: String(form.menuNev ?? '').trim(),
				keszetelId: toNullableId(form.keszetelId),
				koretId: toNullableId(form.koretId),
				uditoId: toNullableId(form.uditoId),
				elerheto: buildElerheto(form),
				ar: parsePrice(form.ar),
				kepFile: form.kepFile ?? null,
			};
			return isCreate ? base : { ...base, id: form.id };
		},
		messages: { create: 'Menü létrehozva.', update: 'Menü frissítve.', delete: 'Menü törölve.' },
	};
}
