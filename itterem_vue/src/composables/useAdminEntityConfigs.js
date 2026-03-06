import {
	ORDER_STATUSES,
	createCategory,
	createDrink,
	createIngredient,
	createMenu,
	createMeal,
	createSide,
	deleteCategory,
	deleteDrink,
	deleteIngredient,
	deleteMenu,
	deleteMeal,
	deleteOrder,
	deleteSide,
	getMealById,
	updateCategory,
	updateDrink,
	updateIngredient,
	updateMenu,
	updateMeal,
	updateOrderStatus,
	updateSide,
} from '../api.js';
import {
	parsePrice,
	normalizePriceValue,
	formatPrice,
	normalizeAvailable,
	normalizeSelectValue,
	buildElerheto,
	buildBasePayload,
	buildSelectOptions,
	requiredName,
	requiredPrice,
	requiredImageOnCreate,
	requiredSelect,
	requiredAtLeastOneSelect,
	validateAll,
} from '../admin-helpers.js';
import {
	formatDateTime,
	formatOrderItems,
	getImageSrcFromItem,
	getMealCategoryId as getMealCatId,
	getMealIngredientNames,
} from '../utils.js';

const AVAILABLE_OPTIONS = [
	{ value: 1, label: 'Igen' },
	{ value: 0, label: 'Nem' },
];

// ── Local helpers ───────────────────────────────────────────────

function getMenuMealId(menu) {
	return menu?.keszetelId ?? null;
}

function getMenuSideId(menu) {
	return menu?.koretId ?? null;
}

function getMenuDrinkId(menu) {
	return menu?.uditoId ?? null;
}

/**
 * Build entity configs for the admin dashboard.
 * @param {{ kategoriak, hozzavalok, keszetelek, koretek, uditok }} refs – reactive refs to entity lists
 */
export function useAdminEntityConfigs({ kategoriak, hozzavalok, keszetelek, koretek, uditok }) {
	function getMealCategoryName(meal) {
		const catId = getMealCatId(meal);
		const list = kategoriak.value;
		const found = list.find((c) => String(c?.id ?? '') === String(catId ?? ''));
		return String(found?.nev ?? '-');
	}

	function formatMealIngredients(item) {
		const names = getMealIngredientNames(item);
		return names.length ? names.join(', ') : '-';
	}

	const entityConfigs = {
		ingredient: {
			label: 'Hozzávaló',
			tableTitle: 'Hozzávalók Kezelése',
			addLabel: '+ Új hozzávaló',
			hasImage: false,
			bulk: { canDelete: true, supportsAvailability: false, supportsPrice: false, supportsStatus: false },
			api: { create: createIngredient, update: updateIngredient, delete: deleteIngredient },
			columns: [
				{ key: 'id', label: 'ID' },
				{ key: 'hozzavaloNev', label: 'Név', bold: true },
			],
			formFields: [{ key: 'nev', label: 'Név', type: 'text' }],
			mapItemToForm: (item) => ({
				id: item?.id,
				nev: String(item?.hozzavaloNev ?? ''),
			}),
			defaultForm: () => ({ nev: '' }),
			validate: (form) => requiredName(form),
			buildPayload: (form, isCreate) => {
				const payload = { nev: String(form.nev ?? '').trim() };
				return isCreate ? payload : { ...payload, id: form.id };
			},
			messages: { create: 'Hozzávaló létrehozva.', update: 'Hozzávaló frissítve.', delete: 'Hozzávaló törölve.' },
		},

		category: {
			label: 'Kategória',
			tableTitle: 'Kategóriák Kezelése',
			addLabel: '+ Új kategória',
			hasImage: false,
			bulk: { canDelete: true, supportsAvailability: false, supportsPrice: false, supportsStatus: false },
			api: { create: createCategory, update: updateCategory, delete: deleteCategory },
			columns: [
				{ key: 'id', label: 'ID' },
				{ key: 'nev', label: 'Név', bold: true },
			],
			formFields: [{ key: 'nev', label: 'Név', type: 'text' }],
			mapItemToForm: (item) => ({
				id: item?.id,
				nev: String(item?.nev ?? ''),
			}),
			defaultForm: () => ({ nev: '' }),
			validate: (form) => requiredName(form),
			buildPayload: (form, isCreate) => {
				const payload = { nev: String(form.nev ?? '').trim() };
				return isCreate ? payload : { ...payload, id: form.id };
			},
			messages: { create: 'Kategória létrehozva.', update: 'Kategória frissítve.', delete: 'Kategória törölve.' },
		},

		meal: {
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
				hozzavalokIds: (Array.isArray(item?.hozzavalok) ? item.hozzavalok : [])
					.map((h) => h?.id)
					.filter((v) => v != null)
					.map((v) => String(v)),
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
						(f) => requiredName(f),
						(f) => requiredSelect(f, 'kategoriaId', 'Kategória'),
						(f) => requiredPrice(f),
						(f, c) => requiredImageOnCreate(f, c),
					],
					form,
					isCreate,
				),
			buildPayload: (form, isCreate) => {
				const base = buildBasePayload(form, { includeDescription: true });
				const hozzavalokIds = (Array.isArray(form.hozzavalokIds) ? form.hozzavalokIds : [])
					.map((v) => String(v).trim())
					.filter(Boolean);
				return isCreate
					? { ...base, kategoriaId: String(form.kategoriaId ?? '').trim(), hozzavalokIds }
					: { ...base, id: form.id, kategoriaId: String(form.kategoriaId ?? '').trim(), hozzavalokIds };
			},
			messages: { create: 'Készétel létrehozva.', update: 'Készétel frissítve.', delete: 'Készétel törölve.' },
		},

		side: {
			label: 'Köret',
			tableTitle: 'Köretek Kezelése',
			addLabel: '+ Új köret',
			hasImage: true,
			bulk: { canDelete: true, supportsAvailability: true, supportsPrice: true, supportsStatus: false },
			api: { create: createSide, update: updateSide, delete: deleteSide },
			columns: [
				{ key: 'id', label: 'ID' },
				{ key: 'nev', label: 'Név', bold: true },
				{ key: 'leiras', label: 'Leírás' },
				{ key: 'ar', label: 'Ár', format: (item) => formatPrice(item.ar) },
				{ key: 'elerheto', label: 'Elérhető', type: 'available' },
			],
			formFields: [
				{ key: 'nev', label: 'Név', type: 'text' },
				{ key: 'leiras', label: 'Leírás', type: 'textarea' },
				{ key: 'elerheto', label: 'Elérhető', type: 'select', options: AVAILABLE_OPTIONS },
				{ key: 'ar', label: 'Ár (Ft)', type: 'number', min: 0, step: 1 },
			],
			mapItemToForm: (item) => ({
				id: item?.id,
				nev: String(item?.nev ?? ''),
				leiras: String(item?.leiras ?? ''),
				elerheto: normalizeAvailable(item?.elerheto) ? 1 : 0,
				ar: normalizePriceValue(item?.ar),
				kepFile: null,
				currentImageUrl: getImageSrcFromItem(item, 'kep'),
			}),
			defaultForm: () => ({
				nev: '',
				leiras: '',
				elerheto: 1,
				ar: '',
				kepFile: null,
				currentImageUrl: '',
			}),
			validate: (form, isCreate) =>
				validateAll(
					[(f) => requiredName(f), (f) => requiredPrice(f), (f, c) => requiredImageOnCreate(f, c)],
					form,
					isCreate,
				),
			buildPayload: (form, isCreate) => {
				const base = buildBasePayload(form, { includeDescription: true });
				return isCreate ? base : { ...base, id: form.id };
			},
			messages: { create: 'Köret létrehozva.', update: 'Köret frissítve.', delete: 'Köret törölve.' },
		},

		drink: {
			label: 'Üdítő',
			tableTitle: 'Üdítők Kezelése',
			addLabel: '+ Új üdítő',
			hasImage: true,
			bulk: { canDelete: true, supportsAvailability: true, supportsPrice: true, supportsStatus: false },
			api: { create: createDrink, update: updateDrink, delete: deleteDrink },
			columns: [
				{ key: 'id', label: 'ID' },
				{ key: 'nev', label: 'Név', bold: true },
				{ key: 'ar', label: 'Ár', format: (item) => formatPrice(item.ar) },
				{ key: 'elerheto', label: 'Elérhető', type: 'available' },
			],
			formFields: [
				{ key: 'nev', label: 'Név', type: 'text' },
				{ key: 'elerheto', label: 'Elérhető', type: 'select', options: AVAILABLE_OPTIONS },
				{ key: 'ar', label: 'Ár (Ft)', type: 'number', min: 0, step: 1 },
			],
			mapItemToForm: (item) => ({
				id: item?.id,
				nev: String(item?.nev ?? ''),
				elerheto: normalizeAvailable(item?.elerheto) ? 1 : 0,
				ar: normalizePriceValue(item?.ar),
				kepFile: null,
				currentImageUrl: getImageSrcFromItem(item, 'kep'),
			}),
			defaultForm: () => ({
				nev: '',
				elerheto: 1,
				ar: '',
				kepFile: null,
				currentImageUrl: '',
			}),
			validate: (form, isCreate) =>
				validateAll(
					[(f) => requiredName(f), (f) => requiredPrice(f), (f, c) => requiredImageOnCreate(f, c)],
					form,
					isCreate,
				),
			buildPayload: (form, isCreate) => {
				const base = buildBasePayload(form);
				return isCreate ? base : { ...base, id: form.id };
			},
			messages: { create: 'Üdítő létrehozva.', update: 'Üdítő frissítve.', delete: 'Üdítő törölve.' },
		},

		menu: {
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
						(f) => requiredName(f, 'menuNev', 'Menü név'),
						(f) => requiredAtLeastOneSelect(f, ['keszetelId', 'koretId'], 'Készétel vagy Köret'),
						(f) => requiredPrice(f),
						(f, c) => requiredImageOnCreate(f, c),
					],
					form,
					isCreate,
				),
			buildPayload: (form, isCreate) => {
				const toNullableId = (value) => {
					const trimmed = String(value ?? '').trim();
					return trimmed === '' ? null : trimmed;
				};
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
		},

		order: {
			label: 'Rendelés',
			tableTitle: 'Rendelések',
			addLabel: '',
			hasImage: false,
			bulk: { canDelete: true, supportsAvailability: false, supportsPrice: false, supportsStatus: true },
			showCreate: false,
			showEdit: true,
			showDelete: true,
			api: { update: ({ id, status }) => updateOrderStatus(id, status), delete: deleteOrder },
			columns: [
				{ key: 'id', label: 'ID' },
				{ key: 'felhasznaloNev', label: 'Felhasználó', bold: true },
				{ key: 'datum', label: 'Dátum', format: (item) => formatDateTime(item?.datum) },
				{ key: 'statusz', label: 'Státusz', type: 'status' },
				{ key: '_items', label: 'Tételek', format: (item) => formatOrderItems(item) },
			],
			formFields: [
				{
					key: 'status',
					label: 'Státusz',
					type: 'select',
					options: ORDER_STATUSES.map((status) => ({ value: status, label: status })),
				},
			],
			mapItemToForm: (item) => ({
				id: item?.id,
				status: String(item?.statusz ?? ''),
			}),
			defaultForm: () => ({ status: '' }),
			validate: (form) => {
				const requiredError = requiredSelect(form, 'status', 'Státusz');
				if (requiredError) return requiredError;
				if (!ORDER_STATUSES.includes(String(form.status ?? '').trim())) {
					return `Érvénytelen státusz. Engedélyezett értékek: ${ORDER_STATUSES.join(', ')}`;
				}
				return null;
			},
			buildPayload: (form, isCreate) => ({
				...(isCreate ? {} : { id: form.id }),
				status: String(form.status ?? '').trim(),
			}),
			messages: { update: 'Rendelés státusza frissítve.', delete: 'Rendelés törölve.' },
		},
	};

	return {
		entityConfigs,
		getMenuMealId,
		getMenuSideId,
		getMenuDrinkId,
	};
}
