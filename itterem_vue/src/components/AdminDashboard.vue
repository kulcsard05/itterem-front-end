<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
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
	getCategories,
	getDrinks,
	getIngredients,
	getMeals,
	getMenus,
	getOrders,
	getSides,
	updateCategory,
	updateDrink,
	updateIngredient,
	updateMenu,
	updateMeal,
	updateSide,
} from '../api.js';
import AdminTable from './AdminTable.vue';
import AdminEditModal from './AdminEditModal.vue';
import ConfirmModal from './ConfirmModal.vue';
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
	validateAll,
} from '../admin-helpers.js';

import { getImageSrcFromItem } from '../utils.js';

// ── Events ──────────────────────────────────────────────────────
const emit = defineEmits(['back', 'logout']);

// ── Reactive State ──────────────────────────────────────────────
const activeTab = ref('menuk');

const menukRaw = ref([]);
const kategoriak = ref([]);
const hozzavalok = ref([]);
const keszetelek = ref([]);
const koretek = ref([]);
const uditok = ref([]);
const rendelesekRaw = ref([]);

const isLoading = ref(false);
const loadError = ref('');
const actionError = ref('');
const actionSuccess = ref('');

const showEditModal = ref(false);
const editMode = ref('edit');
const editType = ref('');
const editForm = ref({});
const selectedImagePreviewUrl = ref('');
const saving = ref(false);

const showConfirmModal = ref(false);
const deleteTarget = ref(null);
const deleting = ref(false);

// ── Helpers ─────────────────────────────────────────────────────
function clearFeedback() {
	actionError.value = '';
	actionSuccess.value = '';
}

function resolveIdByName(list, name, nameKeys = ['nev']) {
	const n = String(name ?? '')
		.trim()
		.toLowerCase();
	if (!n) return null;
	const found = (Array.isArray(list) ? list : []).find((item) =>
		nameKeys.some(
			(key) =>
				String(item?.[key] ?? '')
					.trim()
					.toLowerCase() === n,
		),
	);
	return found?.id ?? null;
}

function getMealCategoryId(meal) {
	const directId = meal?.kategoriaId ?? null;
	return directId != null ? directId : null;
}

function getMenuMealId(menu) {
	const directId = menu?.keszetelId ?? null;
	if (directId != null) return directId;
	return resolveIdByName(keszetelek.value, menu?.keszetelNev);
}

function getMenuSideId(menu) {
	const directId = menu?.koretId ?? null;
	if (directId != null) return directId;
	return resolveIdByName(koretek.value, menu?.koretNev);
}

function getMenuDrinkId(menu) {
	const directId = menu?.uditoId ?? null;
	if (directId != null) return directId;
	return resolveIdByName(uditok.value, menu?.uditoNev);
}

function getMealCategoryName(meal) {
	const catId = getMealCategoryId(meal);
	const found = kategoriak.value.find((c) => String(c?.id ?? '') === String(catId ?? ''));
	return String(found?.nev ?? '-');
}

function getCurrentImageFromItem(item) {
	return getImageSrcFromItem(item, 'kep');
}

function formatDateTime(value) {
	if (!value) return '-';
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return String(value);
	return d.toLocaleString('hu-HU');
}

function getOrderItemName(entry) {
	const mealName = String(entry?.keszetelNev ?? '').trim();
	if (mealName) return mealName;

	const drinkName = String(entry?.uditoNev ?? '').trim();
	if (drinkName) return drinkName;

	const menuName = String(entry?.menuNev ?? '').trim();
	if (menuName) return menuName;

	const sideName = String(entry?.koretNev ?? '').trim();
	if (sideName) return sideName;

	return 'Ismeretlen tétel';
}

function formatOrderItems(order) {
	const list = Array.isArray(order?.rendelesElemeks) ? order.rendelesElemeks : [];
	if (list.length === 0) return '-';

	return list.map((entry) => `${getOrderItemName(entry)} × ${entry?.mennyiseg ?? 0}`).join(' | ');
}

// ── Image Preview ───────────────────────────────────────────────
function clearSelectedImagePreview() {
	if (selectedImagePreviewUrl.value) {
		URL.revokeObjectURL(selectedImagePreviewUrl.value);
		selectedImagePreviewUrl.value = '';
	}
}

onUnmounted(() => {
	clearSelectedImagePreview();
});

const showImageUploadSection = computed(() => entityConfigs[editType.value]?.hasImage ?? false);

const displayedImagePreview = computed(() => {
	if (selectedImagePreviewUrl.value) return selectedImagePreviewUrl.value;
	return (editForm.value?.currentImageUrl ?? '').trim();
});

function onEditImageSelected(event) {
	clearSelectedImagePreview();
	const file = event?.target?.files?.[0] ?? null;
	if (file instanceof File) {
		selectedImagePreviewUrl.value = URL.createObjectURL(file);
	}
	editForm.value = { ...editForm.value, kepFile: file };
}

// ── Entity Configuration ────────────────────────────────────────
// Each entity type is described declaratively: columns, form fields,
// API functions, validation, and payload builders. This eliminates the
// duplicated switch/if-else chains that previously existed for every
// CRUD operation.

const AVAILABLE_OPTIONS = [
	{ value: 1, label: 'Igen' },
	{ value: 0, label: 'Nem' },
];

const entityConfigs = {
	ingredient: {
		label: 'Hozzávaló',
		tableTitle: 'Hozzávalók Kezelése',
		addLabel: '+ Új hozzávaló',
		hasImage: false,
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
		api: { create: createMeal, update: updateMeal, delete: deleteMeal },
		columns: [
			{ key: 'id', label: 'ID' },
			{ key: 'nev', label: 'Név', bold: true },
			{ key: '_kategoria', label: 'Kategória', format: (item) => getMealCategoryName(item) },
			{ key: 'leiras', label: 'Leírás' },
			{ key: 'ar', label: 'Ár', format: (item) => formatPrice(item.ar) },
			{ key: 'elerheto', label: 'Elérhető', type: 'available' },
		],
		formFields: [
			{ key: 'nev', label: 'Név', type: 'text' },
			{ key: 'leiras', label: 'Leírás', type: 'textarea' },
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
			elerheto: normalizeAvailable(item?.elerheto) ? 1 : 0,
			kategoriaId: normalizeSelectValue(getMealCategoryId(item)),
			ar: normalizePriceValue(item?.ar),
			kepFile: null,
			currentImageUrl: getCurrentImageFromItem(item),
		}),
		defaultForm: () => ({
			nev: '',
			leiras: '',
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
			// Backend uses different param names for create vs update
			return isCreate
				? { ...base, katid: String(form.kategoriaId ?? '').trim() }
				: { ...base, id: form.id, kategoriaId: String(form.kategoriaId ?? '').trim() };
		},
		messages: { create: 'Készétel létrehozva.', update: 'Készétel frissítve.', delete: 'Készétel törölve.' },
	},

	side: {
		label: 'Köret',
		tableTitle: 'Köretek Kezelése',
		addLabel: '+ Új köret',
		hasImage: true,
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
			currentImageUrl: getCurrentImageFromItem(item),
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
			currentImageUrl: getCurrentImageFromItem(item),
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
			currentImageUrl: getCurrentImageFromItem(item),
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
					(f) => requiredSelect(f, 'keszetelId', 'Készétel'),
					(f) => requiredSelect(f, 'koretId', 'Köret'),
					(f) => requiredPrice(f),
					(f, c) => requiredImageOnCreate(f, c),
				],
				form,
				isCreate,
			),
		buildPayload: (form, isCreate) => {
			const uditoIdRaw = form.uditoId;
			const uditoId = String(uditoIdRaw ?? '').trim() === '' ? null : uditoIdRaw;
			const base = {
				menuNev: String(form.menuNev ?? '').trim(),
				keszetelId: String(form.keszetelId ?? '').trim(),
				koretId: String(form.koretId ?? '').trim(),
				uditoId,
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
		showCreate: false,
		showEdit: false,
		showDelete: true,
		api: { delete: deleteOrder },
		columns: [
			{ key: 'id', label: 'ID' },
			{ key: 'felhasznaloNev', label: 'Felhasználó', bold: true },
			{ key: 'datum', label: 'Dátum', format: (item) => formatDateTime(item?.datum) },
			{ key: 'statusz', label: 'Státusz' },
			{ key: '_items', label: 'Tételek', format: (item) => formatOrderItems(item) },
		],
		messages: { delete: 'Rendelés törölve.' },
	},
};

// ── Tabs & Table Items ──────────────────────────────────────────
const tabs = [
	{ key: 'rendelesek', label: 'Rendelések', entityType: 'order' },
	{ key: 'menuk', label: 'Menük', entityType: 'menu' },
	{ key: 'kategoriak', label: 'Kategóriák', entityType: 'category' },
	{ key: 'hozzavalok', label: 'Hozzávalók', entityType: 'ingredient' },
	{ key: 'keszetelek', label: 'Készételek', entityType: 'meal' },
	{ key: 'koretek', label: 'Köretek', entityType: 'side' },
	{ key: 'uditok', label: 'Üdítők', entityType: 'drink' },
];

const rendelesek = computed(() =>
	(rendelesekRaw.value || []).slice().sort((a, b) => {
		const ta = new Date(a?.datum ?? 0).getTime();
		const tb = new Date(b?.datum ?? 0).getTime();
		return tb - ta;
	}),
);

// Menus need enrichment (display names for FK references)
const menuk = computed(() =>
	(menukRaw.value || []).map((menu) => ({
		...menu,
		menuDisplayName: String(menu?.menuNev ?? '-'),
		keszetel: String(menu?.keszetelNev ?? '-'),
		koret: String(menu?.koretNev ?? '-'),
		udito: String(menu?.uditoNev ?? '-'),
	})),
);

const tabItemsMap = computed(() => ({
	rendelesek: rendelesek.value,
	menuk: menuk.value,
	kategoriak: kategoriak.value,
	hozzavalok: hozzavalok.value,
	keszetelek: keszetelek.value,
	koretek: koretek.value,
	uditok: uditok.value,
}));

// ── Data Loading ────────────────────────────────────────────────
const dataLoads = [
	{ fn: getOrders, ref: rendelesekRaw, label: 'orders' },
	{ fn: getMenus, ref: menukRaw, label: 'menus' },
	{ fn: getCategories, ref: kategoriak, label: 'categories' },
	{ fn: getIngredients, ref: hozzavalok, label: 'ingredients' },
	{ fn: getMeals, ref: keszetelek, label: 'meals' },
	{ fn: getSides, ref: koretek, label: 'sides' },
	{ fn: getDrinks, ref: uditok, label: 'drinks' },
];

async function loadAdminData() {
	isLoading.value = true;
	loadError.value = '';
	clearFeedback();

	const results = await Promise.allSettled(dataLoads.map((l) => l.fn()));

	results.forEach((result, i) => {
		const load = dataLoads[i];
		if (result.status === 'fulfilled') {
			load.ref.value = Array.isArray(result.value) ? result.value : [];
		} else {
			load.ref.value = [];
			loadError.value =
				loadError.value ||
				(result.reason instanceof Error ? result.reason.message : `Failed to load ${load.label}`);
		}
	});

	isLoading.value = false;
}

onMounted(loadAdminData);

// ── Modal ───────────────────────────────────────────────────────
const isCreateMode = computed(() => editMode.value === 'create');

const editModalTitle = computed(() => {
	const config = entityConfigs[editType.value];
	if (!config) return 'Szerkesztés';
	const modeText = isCreateMode.value ? 'létrehozása' : 'szerkesztése';
	return `${config.label} ${modeText}`;
});

const activeFormFields = computed(() => entityConfigs[editType.value]?.formFields ?? []);

function openModal(type, item = null) {
	clearFeedback();
	clearSelectedImagePreview();
	const config = entityConfigs[type];
	if (!config) return;

	editMode.value = item ? 'edit' : 'create';
	editType.value = type;
	editForm.value = item ? config.mapItemToForm(item) : config.defaultForm();
	showEditModal.value = true;
}

function closeEditModal() {
	clearSelectedImagePreview();
	showEditModal.value = false;
	editMode.value = 'edit';
	editType.value = '';
	editForm.value = {};
	clearFeedback();
}

// ── Save ────────────────────────────────────────────────────────
async function saveEdit() {
	clearFeedback();
	saving.value = true;

	try {
		const config = entityConfigs[editType.value];
		if (!config) throw new Error('Unknown type');

		const isCreate = isCreateMode.value;
		if (!isCreate && !editForm.value.id && editForm.value.id !== 0) {
			actionError.value = 'Missing id.';
			return;
		}

		const validationError = config.validate(editForm.value, isCreate);
		if (validationError) {
			actionError.value = validationError;
			return;
		}

		const payload = config.buildPayload(editForm.value, isCreate);
		const apiFn = isCreate ? config.api.create : config.api.update;
		const res = await apiFn(payload);
		if (!res.ok) throw new Error(res.message || `Failed to ${isCreate ? 'create' : 'update'}`);

		actionSuccess.value = isCreate ? config.messages.create : config.messages.update;
		showEditModal.value = false;
		await loadAdminData();
	} catch (err) {
		actionError.value = err instanceof Error ? err.message : 'Save failed';
	} finally {
		saving.value = false;
	}
}

// ── Delete ──────────────────────────────────────────────────────
function requestDelete(type, item) {
	clearFeedback();
	deleteTarget.value = { type, item };
	showConfirmModal.value = true;
}

async function confirmDelete() {
	if (!deleteTarget.value) return;
	const { type, item } = deleteTarget.value;
	const config = entityConfigs[type];
	if (!config) return;

	deleting.value = true;
	clearFeedback();

	try {
		const res = await config.api.delete(item.id);
		if (!res.ok) throw new Error(res.message || 'Delete failed');
		actionSuccess.value = config.messages.delete;
		await loadAdminData();
	} catch (err) {
		actionError.value = err instanceof Error ? err.message : 'Delete failed';
	} finally {
		deleting.value = false;
		showConfirmModal.value = false;
		deleteTarget.value = null;
	}
}

function cancelDelete() {
	showConfirmModal.value = false;
	deleteTarget.value = null;
}

const confirmMessage = computed(() => {
	if (deleteTarget.value?.type === 'order') return 'Biztosan törlöd ezt a rendelést?';
	return 'Biztosan törlöd ezt az elemet?';
});
</script>

<template>
	<div class="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 p-5">
		<!-- Header -->
		<div class="bg-white p-8 rounded-xl shadow-md mb-5">
			<div class="flex justify-between items-center gap-5 max-md:flex-col max-md:items-start">
				<div>
					<h1 class="text-4xl font-bold text-gray-800 mb-2">Itterem Admin Panel</h1>
					<div class="text-gray-500">Étterem Kezelő Rendszer</div>
				</div>
				<div class="flex gap-3 max-md:w-full">
					<button
						class="px-5 py-2.5 rounded-lg font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition cursor-pointer max-md:flex-1"
						@click="emit('back')"
					>
						← Vissza
					</button>
					<button
						class="px-5 py-2.5 rounded-lg font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition cursor-pointer max-md:flex-1"
						@click="loadAdminData"
					>
						↻ Frissítés
					</button>
					<button
						class="px-5 py-2.5 rounded-lg font-semibold bg-red-100 text-red-800 hover:bg-red-200 transition cursor-pointer max-md:flex-1"
						@click="emit('logout')"
					>
						Kijelentkezés
					</button>
				</div>
			</div>
		</div>

		<!-- Navigation Tabs -->
		<div class="flex gap-2 bg-white p-4 rounded-xl shadow-md mb-5 overflow-x-auto flex-wrap">
			<button
				v-for="tab in tabs"
				:key="tab.key"
				:class="[
					'px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition cursor-pointer',
					activeTab === tab.key
						? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
						: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
				]"
				@click="activeTab = tab.key"
			>
				{{ tab.label }}
			</button>
		</div>

		<!-- Content Area -->
		<div class="bg-white rounded-xl shadow-md p-8 min-h-[500px]">
			<div v-if="isLoading" class="mb-4 rounded-lg bg-white/90 p-3 text-sm font-medium text-gray-800">
				Adatok betöltése...
			</div>
			<div v-else-if="loadError" class="mb-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
				{{ loadError }}
			</div>

			<div v-if="actionError" class="mb-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
				{{ actionError }}
			</div>
			<div v-if="actionSuccess" class="mb-4 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-800">
				{{ actionSuccess }}
			</div>

			<template v-for="tab in tabs" :key="tab.key">
				<AdminTable
					v-if="activeTab === tab.key"
					:columns="entityConfigs[tab.entityType].columns"
					:items="tabItemsMap[tab.key] ?? []"
					:title="entityConfigs[tab.entityType].tableTitle"
					:add-label="entityConfigs[tab.entityType].addLabel"
					:show-create="entityConfigs[tab.entityType].showCreate ?? true"
					:show-edit="entityConfigs[tab.entityType].showEdit ?? true"
					:show-delete="entityConfigs[tab.entityType].showDelete ?? true"
					@create="openModal(tab.entityType)"
					@edit="(item) => openModal(tab.entityType, item)"
					@delete="(item) => requestDelete(tab.entityType, item)"
				/>
			</template>
		</div>

		<!-- Edit / Create Modal -->
		<AdminEditModal
			:show="showEditModal"
			:title="editModalTitle"
			:is-create-mode="isCreateMode"
			:fields="activeFormFields"
			:form="editForm"
			:show-image-upload="showImageUploadSection"
			:image-preview="displayedImagePreview"
			:saving="saving"
			@close="closeEditModal"
			@save="saveEdit"
			@image-selected="onEditImageSelected"
			@update:form="(val) => (editForm = val)"
		/>

		<!-- Confirm Delete Modal -->
		<ConfirmModal
			:show="showConfirmModal"
			:loading="deleting"
			title="Törlés megerősítése"
			:message="confirmMessage"
			@confirm="confirmDelete"
			@cancel="cancelDelete"
		/>
	</div>
</template>
