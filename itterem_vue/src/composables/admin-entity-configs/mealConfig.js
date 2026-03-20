import {
	createMeal,
	deleteMeal,
	getMealById,
	updateMeal,
} from '../../api.js';
import {
	buildBasePayload,
	buildSelectOptions,
	normalizeAvailable,
	normalizePriceValue,
	normalizeSelectValue,
	requiredImageOnCreate,
	requiredName,
	requiredPrice,
	requiredSelect,
	validateAll,
	formatPrice,
} from '../../admin-helpers.js';
import {
	asArray,
	getImageSrcFromItem,
	getMealCategoryId as getMealCatId,
	getMealIngredientNames,
} from '../../utils.js';
import { AVAILABLE_OPTIONS, toStringList } from './shared.js';

export function createMealConfig({ kategoriak, hozzavalok }) {
	function getMealCategoryName(meal) {
		const catId = getMealCatId(meal);
		const list = kategoriak.value;
		const found = list.find((category) => String(category?.id ?? '') === String(catId ?? ''));
		return String(found?.nev ?? '-');
	}

	function formatMealIngredients(item) {
		const names = getMealIngredientNames(item);
		return names.length ? names.join(', ') : '-';
	}

	return {
		label: 'Készétel',
		tableTitle: 'Készételek Kezelése',
		addLabel: '+ Új készétel',
		hasImage: true,
		bulk: {
			canDelete: true,
			supportsAvailability: true,
			supportsPrice: true,
			supportsStatus: false,
			resolveItemForUpdate: async (item) => {
				if (item?.id == null) return item;
				try {
					const full = await getMealById(item.id);
					return full && typeof full === 'object' ? { ...item, ...full } : item;
				} catch {
					return item;
				}
			},
		},
		api: { create: createMeal, update: updateMeal, delete: deleteMeal },
		columns: [
			{ key: 'id', label: 'ID' },
			{ key: 'nev', label: 'Név', bold: true },
			{ key: '_kategoria', label: 'Kategória', format: (item) => getMealCategoryName(item) },
			{ key: '_hozzavalok', label: 'Hozzávalók', format: (item) => formatMealIngredients(item) },
			{ key: 'leiras', label: 'Leírás' },
			{ key: 'ar', label: 'Ár', format: (item) => formatPrice(item.ar) },
			{ key: 'elerheto', label: 'Elérhető', type: 'available' },
		],
		formFields: [
			{ key: 'nev', label: 'Név', type: 'text' },
			{ key: 'leiras', label: 'Leírás', type: 'textarea' },
			{
				key: 'hozzavalokIds',
				label: 'Hozzávalók',
				type: 'multiselect',
				options: () => buildSelectOptions(hozzavalok.value, { valueKey: 'id', labelKey: 'hozzavaloNev' }),
				helpText: 'Több hozzávaló is kiválasztható.',
			},
			{ key: 'elerheto', label: 'Elérhető', type: 'select', options: AVAILABLE_OPTIONS },
			{ key: 'ar', label: 'Ár (Ft)', type: 'number', min: 0, step: 1 },
			{
				key: 'kategoriaId',
				label: 'Kategória',
				type: 'select',
				placeholder: 'Válassz kategóriát',
				options: () => buildSelectOptions(kategoriak.value),
			},
		],
		mapItemToForm: (item) => ({
			id: item?.id,
			nev: String(item?.nev ?? ''),
			leiras: String(item?.leiras ?? ''),
			hozzavalokIds: asArray(item?.hozzavalok)
				.map((ingredient) => ingredient?.id)
				.filter((value) => value != null)
				.map((value) => String(value)),
			elerheto: normalizeAvailable(item?.elerheto) ? 1 : 0,
			kategoriaId: normalizeSelectValue(getMealCatId(item)),
			ar: normalizePriceValue(item?.ar),
			kepFile: null,
			currentImageUrl: getImageSrcFromItem(item, 'kep'),
		}),
		defaultForm: () => ({
			nev: '',
			leiras: '',
			hozzavalokIds: [],
			elerheto: 1,
			kategoriaId: '',
			ar: '',
			kepFile: null,
			currentImageUrl: '',
		}),
		validate: (form, isCreate) =>
			validateAll(
				[
					(currentForm) => requiredName(currentForm),
					(currentForm) => requiredSelect(currentForm, 'kategoriaId', 'Kategória'),
					(currentForm) => requiredPrice(currentForm),
					(currentForm, createMode) => requiredImageOnCreate(currentForm, createMode),
				],
				form,
				isCreate,
			),
		buildPayload: (form, isCreate) => {
			const base = buildBasePayload(form, { includeDescription: true });
			const hozzavalokIds = toStringList(form.hozzavalokIds);
			const payload = {
				...base,
				kategoriaId: String(form.kategoriaId ?? '').trim(),
				hozzavalokIds,
			};
			return isCreate ? payload : { ...payload, id: form.id };
		},
		messages: { create: 'Készétel létrehozva.', update: 'Készétel frissítve.', delete: 'Készétel törölve.' },
	};
}
