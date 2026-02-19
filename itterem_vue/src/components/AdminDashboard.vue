<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  createCategory, createDrink, createIngredient, createMenu, createMeal, createSide,
  deleteCategory, deleteDrink, deleteIngredient, deleteMenu, deleteMeal, deleteSide,
  getApiBaseUrl, getCategories, getDrinks, getIngredients, getMeals, getMenus, getSides,
  updateCategory, updateDrink, updateIngredient, updateMenu, updateMeal, updateSide,
} from '../api.js';
import AdminTable from './AdminTable.vue';
import ConfirmModal from './ConfirmModal.vue';

// ── Props ───────────────────────────────────────────────────────
const props = defineProps({
  onBack: { type: Function, default: undefined },
  onLogout: { type: Function, default: undefined },
});

// ── Reactive State ──────────────────────────────────────────────
const activeTab = ref('menuk');

const menukRaw = ref([]);
const kategoriak = ref([]);
const hozzavalok = ref([]);
const keszetelek = ref([]);
const koretek = ref([]);
const uditok = ref([]);

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

function normalizeAvailable(value) {
  return value === 1 || value === true;
}

function normalizeSelectValue(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function resolveIdByName(list, name, nameKeys = ['nev']) {
  const n = String(name ?? '').trim().toLowerCase();
  if (!n) return null;
  const found = (Array.isArray(list) ? list : []).find((item) =>
    nameKeys.some((key) => String(item?.[key] ?? '').trim().toLowerCase() === n),
  );
  return found?.id ?? null;
}

function getMealCategoryId(meal) {
  const directId = meal?.kategoriaId ?? meal?.kategoraId ?? meal?.kategoria?.id ?? null;
  if (directId != null) return directId;
  return resolveIdByName(kategoriak.value, meal?.kategoriaNev ?? meal?.kategoria?.nev ?? meal?.kategoriaName);
}

function getMenuMealId(menu) {
  const directId = menu?.keszetelId ?? menu?.keszetel?.id ?? null;
  if (directId != null) return directId;
  return resolveIdByName(keszetelek.value, menu?.keszetelNev ?? menu?.keszetel);
}

function getMenuSideId(menu) {
  const directId = menu?.koretId ?? menu?.koret?.id ?? null;
  if (directId != null) return directId;
  return resolveIdByName(koretek.value, menu?.koretNev ?? menu?.koret);
}

function getMenuDrinkId(menu) {
  const directId = menu?.uditoId ?? menu?.udito?.id ?? null;
  if (directId != null) return directId;
  return resolveIdByName(uditok.value, menu?.uditoNev ?? menu?.udito);
}

function parsePrice(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

function normalizePriceValue(value) {
  if (value == null || String(value).trim() === '') return '';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '';
  return String(Math.round(parsed));
}

function formatPrice(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '-';
  return `${parsed.toLocaleString('hu-HU')} Ft`;
}

function getMealCategoryName(meal) {
  const directName = String(meal?.kategoriaNev ?? meal?.kategoria?.nev ?? meal?.kategoriaName ?? '').trim();
  if (directName) return directName;
  const catId = getMealCategoryId(meal);
  const found = kategoriak.value.find((c) => String(c?.id ?? '') === String(catId ?? ''));
  return String(found?.nev ?? '-');
}

function looksLikeBase64Binary(value) {
  const s = String(value ?? '').trim();
  if (s.length < 40 || /[\s]/.test(s)) return false;
  return /^[A-Za-z0-9+/=]+$/.test(s);
}

function toAbsoluteImageUrl(rawValue) {
  const value = String(rawValue ?? '').trim();
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('blob:')) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (looksLikeBase64Binary(value)) return `data:image/jpeg;base64,${value}`;
  const path = value.startsWith('/') ? value : `/${value}`;
  return `${getApiBaseUrl()}${path}`;
}

function getCurrentImageFromItem(item) {
  if (!item || typeof item !== 'object') return '';
  for (const key of ['kep', 'kepUrl', 'image', 'imageUrl', 'kepBase64']) {
    const resolved = toAbsoluteImageUrl(item[key]);
    if (resolved) return resolved;
  }
  return '';
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
  return String(editForm.value?.currentImageUrl ?? '').trim();
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

const AVAILABLE_OPTIONS = () => [
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
    formFields: [
      { key: 'nev', label: 'Név', type: 'text' },
    ],
    mapItemToForm: (item) => ({
      id: item?.id,
      nev: String(item?.hozzavaloNev ?? ''),
    }),
    defaultForm: () => ({ nev: '' }),
    validate: (form) => {
      if (!String(form.nev ?? '').trim()) return 'Név kötelező.';
      return null;
    },
    buildPayload: (form, isCreate) => {
      const nev = String(form.nev ?? '').trim();
      return isCreate ? { nev } : { id: form.id, nev };
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
    formFields: [
      { key: 'nev', label: 'Név', type: 'text' },
    ],
    mapItemToForm: (item) => ({
      id: item?.id,
      nev: String(item?.nev ?? ''),
    }),
    defaultForm: () => ({ nev: '' }),
    validate: (form) => {
      if (!String(form.nev ?? '').trim()) return 'Név kötelező.';
      return null;
    },
    buildPayload: (form, isCreate) => {
      const nev = String(form.nev ?? '').trim();
      return isCreate ? { nev } : { id: form.id, nev };
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
        key: 'kategoriaId', label: 'Kategória', type: 'select',
        placeholder: 'Válassz kategóriát',
        options: () => kategoriak.value.map((k) => ({ value: String(k.id), label: k.nev })),
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
      nev: '', leiras: '', elerheto: 1, kategoriaId: '', ar: '',
      kepFile: null, currentImageUrl: '',
    }),
    validate: (form, isCreate) => {
      if (!String(form.nev ?? '').trim()) return 'Név kötelező.';
      if (!String(form.kategoriaId ?? '').trim()) return 'Kategória kötelező.';
      if (parsePrice(form.ar) === null) return 'Érvényes ár kötelező (0 vagy nagyobb).';
      if (isCreate && !form.kepFile) return 'Kép feltöltése kötelező.';
      return null;
    },
    buildPayload: (form, isCreate) => {
      const base = {
        nev: String(form.nev ?? '').trim(),
        leiras: String(form.leiras ?? '').trim(),
        elerheto: String(form.elerheto ?? '0') === '1' ? 1 : 0,
        ar: parsePrice(form.ar),
        kepFile: form.kepFile ?? null,
      };
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
      nev: '', leiras: '', elerheto: 1, ar: '',
      kepFile: null, currentImageUrl: '',
    }),
    validate: (form, isCreate) => {
      if (!String(form.nev ?? '').trim()) return 'Név kötelező.';
      if (parsePrice(form.ar) === null) return 'Érvényes ár kötelező (0 vagy nagyobb).';
      if (isCreate && !form.kepFile) return 'Kép feltöltése kötelező.';
      return null;
    },
    buildPayload: (form, isCreate) => {
      const base = {
        nev: String(form.nev ?? '').trim(),
        leiras: String(form.leiras ?? '').trim(),
        elerheto: String(form.elerheto ?? '0') === '1' ? 1 : 0,
        ar: parsePrice(form.ar),
        kepFile: form.kepFile ?? null,
      };
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
      nev: '', elerheto: 1, ar: '',
      kepFile: null, currentImageUrl: '',
    }),
    validate: (form, isCreate) => {
      if (!String(form.nev ?? '').trim()) return 'Név kötelező.';
      if (parsePrice(form.ar) === null) return 'Érvényes ár kötelező (0 vagy nagyobb).';
      if (isCreate && !form.kepFile) return 'Kép feltöltése kötelező.';
      return null;
    },
    buildPayload: (form, isCreate) => {
      const base = {
        nev: String(form.nev ?? '').trim(),
        elerheto: String(form.elerheto ?? '0') === '1' ? 1 : 0,
        ar: parsePrice(form.ar),
        kepFile: form.kepFile ?? null,
      };
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
        key: 'keszetelId', label: 'Készétel', type: 'select',
        placeholder: 'Válassz készételt',
        options: () => keszetelek.value.map((m) => ({ value: String(m.id), label: m.nev })),
      },
      {
        key: 'koretId', label: 'Köret', type: 'select',
        placeholder: 'Válassz köretet',
        options: () => koretek.value.map((k) => ({ value: String(k.id), label: k.nev })),
      },
      {
        key: 'uditoId', label: 'Üdítő', type: 'select',
        placeholder: 'Nincs ital',
        helpText: 'A "Nincs ital" (NULL) az alapértelmezett.',
        options: () => uditok.value.map((u) => ({ value: String(u.id), label: u.nev })),
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
      menuNev: '', keszetelId: '', koretId: '', uditoId: '', elerheto: 1, ar: '',
      kepFile: null, currentImageUrl: '',
    }),
    validate: (form, isCreate) => {
      if (!String(form.menuNev ?? '').trim()) return 'Menü név kötelező.';
      if (!String(form.keszetelId ?? '').trim()) return 'Készétel kötelező.';
      if (!String(form.koretId ?? '').trim()) return 'Köret kötelező.';
      if (parsePrice(form.ar) === null) return 'Érvényes ár kötelező (0 vagy nagyobb).';
      if (isCreate && !form.kepFile) return 'Kép feltöltése kötelező.';
      return null;
    },
    buildPayload: (form, isCreate) => {
      const uditoIdRaw = form.uditoId;
      const uditoId = String(uditoIdRaw ?? '').trim() === '' ? null : uditoIdRaw;
      const base = {
        menuNev: String(form.menuNev ?? '').trim(),
        keszetelId: String(form.keszetelId ?? '').trim(),
        koretId: String(form.koretId ?? '').trim(),
        uditoId,
        elerheto: String(form.elerheto ?? '0') === '1' ? 1 : 0,
        ar: parsePrice(form.ar),
        kepFile: form.kepFile ?? null,
      };
      return isCreate ? base : { ...base, id: form.id };
    },
    messages: { create: 'Menü létrehozva.', update: 'Menü frissítve.', delete: 'Menü törölve.' },
  },
};

// ── Tabs & Table Items ──────────────────────────────────────────
const tabs = [
  { key: 'menuk', label: 'Menük', entityType: 'menu' },
  { key: 'kategoriak', label: 'Kategóriák', entityType: 'category' },
  { key: 'hozzavalok', label: 'Hozzávalók', entityType: 'ingredient' },
  { key: 'keszetelek', label: 'Készételek', entityType: 'meal' },
  { key: 'koretek', label: 'Köretek', entityType: 'side' },
  { key: 'uditok', label: 'Üdítők', entityType: 'drink' },
];

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
  menuk: menuk.value,
  kategoriak: kategoriak.value,
  hozzavalok: hozzavalok.value,
  keszetelek: keszetelek.value,
  koretek: koretek.value,
  uditok: uditok.value,
}));

// ── Data Loading ────────────────────────────────────────────────
const dataLoads = [
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
      loadError.value = loadError.value
        || (result.reason instanceof Error ? result.reason.message : `Failed to load ${load.label}`);
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
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 p-5">
    <!-- Header -->
    <div class="bg-white p-8 rounded-xl shadow-md mb-5">
      <div class="flex justify-between items-center gap-5 max-md:flex-col max-md:items-start">
        <div>
          <h1 class="text-4xl font-bold text-gray-800 mb-2">Itterem Admin Panel</h1>
          <div class="text-gray-500">Restaurant Management System</div>
        </div>
        <div class="flex gap-3 max-md:w-full">
          <button
            class="px-5 py-2.5 rounded-lg font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition cursor-pointer max-md:flex-1"
            @click="props.onBack?.()"
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
            @click="props.onLogout?.()"
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

      <!-- All tab tables — v-show keeps DOM alive for instant tab switches -->
      <AdminTable
        v-for="tab in tabs"
        v-show="activeTab === tab.key"
        :key="tab.key"
        :columns="entityConfigs[tab.entityType].columns"
        :items="tabItemsMap[tab.key] ?? []"
        :title="entityConfigs[tab.entityType].tableTitle"
        :add-label="entityConfigs[tab.entityType].addLabel"
        @create="openModal(tab.entityType)"
        @edit="(item) => openModal(tab.entityType, item)"
        @delete="(item) => requestDelete(tab.entityType, item)"
      />
    </div>

    <!-- Edit / Create Modal -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-5"
      @click.self="closeEditModal"
    >
      <div class="bg-white rounded-2xl shadow-xl max-w-[720px] w-full max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex justify-between items-center p-5 border-b-2 border-gray-200">
          <h3 class="text-xl font-bold text-gray-800">{{ editModalTitle }}</h3>
          <button
            class="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 text-2xl flex items-center justify-center hover:bg-gray-200 transition cursor-pointer"
            @click="closeEditModal"
          >
            ×
          </button>
        </div>

        <!-- Body -->
        <div class="p-5 space-y-4">
          <!-- ID (read-only, edit mode only) -->
          <div v-if="!isCreateMode" class="space-y-2">
            <label class="block text-sm font-semibold text-gray-700">ID</label>
            <input
              :value="editForm.id"
              type="text"
              class="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50"
              disabled
            />
          </div>

          <!-- Dynamic form fields from entity config -->
          <div v-for="field in activeFormFields" :key="field.key" class="space-y-2">
            <label class="block text-sm font-semibold text-gray-700">{{ field.label }}</label>

            <textarea
              v-if="field.type === 'textarea'"
              v-model="editForm[field.key]"
              rows="3"
              class="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition"
            />

            <select
              v-else-if="field.type === 'select'"
              v-model="editForm[field.key]"
              class="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition"
            >
              <option v-if="field.placeholder" value="">{{ field.placeholder }}</option>
              <option v-for="opt in field.options()" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>

            <input
              v-else-if="field.type === 'number'"
              v-model="editForm[field.key]"
              type="number"
              :min="field.min"
              :step="field.step"
              class="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition"
            />

            <input
              v-else
              v-model="editForm[field.key]"
              type="text"
              class="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition"
            />

            <div v-if="field.helpText" class="text-xs text-gray-500">{{ field.helpText }}</div>
          </div>

          <!-- Image section -->
          <template v-if="showImageUploadSection">
            <div class="space-y-2">
              <label class="block text-sm font-semibold text-gray-700">Jelenlegi kép</label>
              <div v-if="displayedImagePreview" class="max-w-xs border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                <img :src="displayedImagePreview" alt="Előnézet" class="block w-full max-h-56 object-cover" />
              </div>
              <div v-else class="text-xs text-gray-500">Nincs kép jelenleg.</div>
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-semibold text-gray-700">Kép feltöltése</label>
              <input
                type="file"
                accept="image/*"
                class="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm"
                @change="onEditImageSelected"
              />
              <div class="text-xs text-gray-500">Az API a kep mezőt IFormFile / string($binary) formában várja.</div>
              <div v-if="editForm.kepFile" class="text-xs text-gray-500">
                Kiválasztva: {{ editForm.kepFile.name }}
              </div>
              <div v-if="!isCreateMode" class="text-xs text-gray-500">
                Szerkesztésnél opcionális, létrehozásnál kötelező.
              </div>
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div class="flex gap-3 p-5 border-t-2 border-gray-200 justify-end">
          <button
            class="px-5 py-2.5 rounded-lg font-semibold text-sm bg-gray-100 text-gray-500 hover:bg-gray-200 transition cursor-pointer"
            :disabled="saving"
            @click="closeEditModal"
          >
            Mégse
          </button>
          <button
            class="px-5 py-2.5 rounded-lg font-semibold text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:shadow-lg transition cursor-pointer disabled:opacity-50"
            :disabled="saving"
            @click="saveEdit"
          >
            {{ saving ? 'Mentés…' : (isCreateMode ? 'Létrehozás' : 'Mentés') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Confirm Delete Modal -->
    <ConfirmModal
      :show="showConfirmModal"
      :loading="deleting"
      title="Törlés megerősítése"
      message="Biztosan törlöd ezt az elemet?"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>
