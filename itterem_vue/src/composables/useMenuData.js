import { ref } from 'vue';
import { MENU_CACHE_STORAGE_KEY } from '../constants.js';
import { findById, getItemTypeLabel } from '../utils.js';
import { readStorageJson, writeStorageJson } from '../storage-utils.js';

// ---------------------------------------------------------------------------
// Module-level singleton – every component shares the same menu data.
// ---------------------------------------------------------------------------

const categories = ref([]);
const meals = ref([]);
const sides = ref([]);
const menus = ref([]);
const drinks = ref([]);

const menuFingerprints = ref({
	categories: '',
	meals: '',
	sides: '',
	menus: '',
	drinks: '',
});

// ---------------------------------------------------------------------------
// Fingerprinting – avoid unnecessary updates when data hasn't changed.
// ---------------------------------------------------------------------------

function toDatasetFingerprint(value) {
	const list = Array.isArray(value) ? value : [];
	if (list.length === 0) return '0';
	// Lightweight fingerprint: item count + first/last item IDs.
	const first = list[0]?.id ?? '';
	const last = list[list.length - 1]?.id ?? '';
	return `${list.length}:${first}:${last}`;
}

function setDatasetIfChanged(key, targetRef, value) {
	const nextList = Array.isArray(value) ? value : [];
	const nextFingerprint = toDatasetFingerprint(nextList);
	if (menuFingerprints.value[key] === nextFingerprint) return false;
	targetRef.value = nextList;
	menuFingerprints.value[key] = nextFingerprint;
	return true;
}

// ---------------------------------------------------------------------------
// localStorage persistence – minimised payload to save quota.
// ---------------------------------------------------------------------------

/** Strip an item to only the fields needed for offline display + cart hydration. */
function minimiseItem(item, fields) {
	if (!item || typeof item !== 'object') return item;
	const res = {};
	for (const f of fields) {
		if (item[f] !== undefined) res[f] = item[f];
	}
	return res;
}

const MEAL_FIELDS = ['id', 'nev', 'ar', 'kep', 'elerheto', 'kategoriaId'];
const SIDE_DRINK_FIELDS = ['id', 'nev', 'ar', 'kep', 'elerheto'];

function minimiseMeal(m) {
	if (!m || typeof m !== 'object') return m;
	const res = minimiseItem(m, MEAL_FIELDS);
	if (Array.isArray(m.hozzavalok) && m.hozzavalok.length) res.hozzavalok = m.hozzavalok;
	return res;
}

function minimiseSide(s) {
	return minimiseItem(s, SIDE_DRINK_FIELDS);
}

function minimiseDrink(d) {
	return minimiseItem(d, SIDE_DRINK_FIELDS);
}

function minimiseMenu(m) {
	if (!m || typeof m !== 'object') return m;
	return {
		id: m.id,
		menuNev: m.menuNev,
		keszetelId: m.keszetelId,
		koretId: m.koretId,
		uditoId: m.uditoId,
		ar: m.ar,
		kep: m.kep,
		elerheto: m.elerheto,
	};
}

function minimiseCategory(c) {
	if (!c || typeof c !== 'object') return c;
	const res = { id: c.id, nev: c.nev };
	// Preserve nested meal references if present (used for category grouping).
	if (Array.isArray(c.kesziteleks) && c.kesziteleks.length) {
		res.kesziteleks = c.kesziteleks.map((k) => minimiseMeal(k));
	}
	return res;
}

function saveMenuCache() {
	const payload = {
		categories: categories.value.map(minimiseCategory),
		meals: meals.value.map(minimiseMeal),
		sides: sides.value.map(minimiseSide),
		menus: menus.value.map(minimiseMenu),
		drinks: drinks.value.map(minimiseDrink),
	};
	writeStorageJson(MENU_CACHE_STORAGE_KEY, payload, {
		storage: localStorage,
		context: '[MenuData] saveMenuCache',
	});
}

function hydrateMenuCache() {
	const payload = readStorageJson(MENU_CACHE_STORAGE_KEY, {
		storage: localStorage,
		fallback: null,
	});
	if (!payload || typeof payload !== 'object') return;
	setDatasetIfChanged('categories', categories, payload.categories);
	setDatasetIfChanged('meals', meals, payload.meals);
	setDatasetIfChanged('sides', sides, payload.sides);
	setDatasetIfChanged('menus', menus, payload.menus);
	setDatasetIfChanged('drinks', drinks, payload.drinks);
}

// ---------------------------------------------------------------------------
// Lookup helpers – used by cart hydration and other consumers.
// ---------------------------------------------------------------------------

function findItem(type, id) {
	switch (type) {
		case 'meals':
		case 'meal':
			return findById(meals.value, id);
		case 'sides':
		case 'side':
			return findById(sides.value, id);
		case 'menus':
		case 'menu':
			return findById(menus.value, id);
		case 'drinks':
		case 'drink':
			return findById(drinks.value, id);
		default:
			return null;
	}
}

function getItemName(type, item) {
	if (!item) return '';
	if (type === 'menus' || type === 'menu') return item?.menuNev ?? '';
	return item?.nev ?? '';
}

/**
 * Hydrate a slim cart entry `{ type, id, quantity }` with display fields
 * looked up from the current menu data.
 */
function hydrateCartItem(entry) {
	if (!entry) return entry;
	const item = findItem(entry.type, entry.id);
	return {
		...entry,
		name: (item ? getItemName(entry.type, item) : '') || entry.name || '',
		price: (item ? (item.ar ?? null) : null) ?? entry.price ?? null,
		kep: (item ? (item.kep ?? '') : '') || entry.kep || '',
		typeLabel: entry.typeLabel || getItemTypeLabel(entry.type),
	};
}

// ---------------------------------------------------------------------------
// Public composable
// ---------------------------------------------------------------------------

export function useMenuData() {
	return {
		categories,
		meals,
		sides,
		menus,
		drinks,
		menuFingerprints,
		setDatasetIfChanged,
		saveMenuCache,
		hydrateMenuCache,
		findItem,
		hydrateCartItem,
	};
}
