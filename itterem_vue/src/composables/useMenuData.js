import { ref } from 'vue';
import {
	MENU_CACHE_STORAGE_KEY,
	MENU_ETAG_STORAGE_KEY,
	MENU_IMAGES_STORAGE_KEY,
} from '../constants.js';
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

const MENU_DATASET_KEYS = ['categories', 'meals', 'sides', 'menus', 'drinks'];

const MENU_DATASET_STORAGE_KEYS = {
	categories: 'menu-cache-categories-v1',
	meals: 'menu-cache-meals-v1',
	sides: 'menu-cache-sides-v1',
	menus: 'menu-cache-menus-v1',
	drinks: 'menu-cache-drinks-v1',
};

const MENU_FIELD_MAP = {
	categories: ['categories', 'kategoriak', 'Kategoria', 'Kategoriak'],
	meals: ['meals', 'keszetelek', 'Keszetelek', 'keszitelek'],
	sides: ['sides', 'koretek', 'Koretek'],
	menus: ['menus', 'menuk', 'Menuk'],
	drinks: ['drinks', 'uditok', 'Uditok'],
};

const MENU_DATASET_REFS = {
	categories,
	meals,
	sides,
	menus,
	drinks,
};

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
		if (item[f] === undefined) continue;
		res[f] = f === 'kep' ? minimiseImageRef(item[f]) : item[f];
	}
	return res;
}

const MEAL_FIELDS = ['id', 'nev', 'ar', 'kep', 'elerheto', 'kategoriaId'];
const SIDE_DRINK_FIELDS = ['id', 'nev', 'ar', 'kep', 'elerheto'];

function minimiseImageRef(value) {
	if (typeof value !== 'string') return value;
	const trimmed = value.trim();
	if (!trimmed) return '';

	// Avoid storing very large inline image payloads in menu cache.
	if (trimmed.startsWith('data:')) return '';
	if (trimmed.length > 512) return '';
	return trimmed;
}

function minimiseIngredient(ingredient) {
	if (!ingredient || typeof ingredient !== 'object') return ingredient;
	return {
		id: ingredient.id,
		nev: ingredient.nev,
	};
}

function minimiseMeal(m) {
	if (!m || typeof m !== 'object') return m;
	const res = minimiseItem(m, MEAL_FIELDS);
	if (Array.isArray(m.hozzavalok) && m.hozzavalok.length) {
		res.hozzavalok = m.hozzavalok.map((ingredient) => minimiseIngredient(ingredient));
	}
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
		kep: minimiseImageRef(m.kep),
		elerheto: m.elerheto,
	};
}

function minimiseCategory(c) {
	if (!c || typeof c !== 'object') return c;
	// Keep categories minimal; nested meals duplicate the meals dataset and can
	// blow localStorage quota.
	return { id: c.id, nev: c.nev };
}

function writeDatasetCache(datasetKey, value, context) {
	const storageKey = MENU_DATASET_STORAGE_KEYS[datasetKey];
	if (!storageKey) return false;
	return writeStorageJson(storageKey, value, {
		storage: localStorage,
		context,
	});
}

function removeLegacyMenuCache() {
	try {
		localStorage.removeItem(MENU_CACHE_STORAGE_KEY);
	} catch {
		// ignore storage failures
	}
}

function saveMenuCache() {
	const datasets = {
		categories: categories.value.map(minimiseCategory),
		meals: meals.value.map(minimiseMeal),
		sides: sides.value.map(minimiseSide),
		menus: menus.value.map(minimiseMenu),
		drinks: drinks.value.map(minimiseDrink),
	};

	const failed = [];
	for (const key of MENU_DATASET_KEYS) {
		const ok = writeDatasetCache(key, datasets[key], `[MenuData] saveMenuCache:${key}`);
		if (!ok) failed.push(key);
	}

	// localStorage often gets filled by image cache first. Prefer preserving the
	// core menu cache by evicting image cache and retrying failed datasets once.
	if (failed.length > 0) {
		try {
			localStorage.removeItem(MENU_IMAGES_STORAGE_KEY);
		} catch {
			// ignore storage failures
		}

		for (const key of [...failed]) {
			const ok = writeDatasetCache(key, datasets[key], `[MenuData] saveMenuCache-retry:${key}`);
			if (ok) failed.splice(failed.indexOf(key), 1);
		}
	}

	// Keep ETag + cache coherent for failed datasets only.
	dropMenuEtags(failed);

	// Free space: the old monolithic key is no longer needed.
	removeLegacyMenuCache();

	return failed.length === 0;
}

function readFirstArray(payload, keys) {
	for (const key of keys) {
		const value = payload?.[key];
		if (Array.isArray(value)) return value;
	}
	return [];
}

function hasArrayForAnyKey(payload, keys) {
	for (const key of keys) {
		if (Array.isArray(payload?.[key])) return true;
	}
	return false;
}

function readMenuEtags() {
	try {
		const raw = localStorage.getItem(MENU_ETAG_STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

function writeMenuEtags(etags) {
	try {
		localStorage.setItem(MENU_ETAG_STORAGE_KEY, JSON.stringify(etags || {}));
	} catch {
		// ignore storage failures
	}
}

function dropMenuEtags(keys) {
	if (!Array.isArray(keys) || keys.length === 0) return;
	const etags = readMenuEtags();
	let changed = false;
	for (const key of keys) {
		if (key in etags) {
			delete etags[key];
			changed = true;
		}
	}
	if (changed) writeMenuEtags(etags);
}

function readDatasetFromStorage(datasetKey) {
	const storageKey = MENU_DATASET_STORAGE_KEYS[datasetKey];
	if (!storageKey) return { found: false, data: [] };

	const raw = readStorageJson(storageKey, {
		storage: localStorage,
		fallback: null,
	});

	if (Array.isArray(raw)) return { found: true, data: raw };

	// Defensive compatibility if a wrapper object was ever persisted.
	if (raw && typeof raw === 'object') {
		const extracted = readFirstArray(raw, MENU_FIELD_MAP[datasetKey] || []);
		if (Array.isArray(extracted)) return { found: true, data: extracted };
		try {
			localStorage.removeItem(storageKey);
		} catch {
			// ignore storage failures
		}
	}

	return { found: false, data: [] };
}

function hydrateMenuCache() {
	const legacyPayload = readStorageJson(MENU_CACHE_STORAGE_KEY, {
		storage: localStorage,
		fallback: null,
	});

	const missingInCache = [];

	for (const key of MENU_DATASET_KEYS) {
		const targetRef = MENU_DATASET_REFS[key];
		const fromDataset = readDatasetFromStorage(key);
		if (fromDataset.found) {
			setDatasetIfChanged(key, targetRef, fromDataset.data);
			continue;
		}

		const legacyKeys = MENU_FIELD_MAP[key] || [];
		const hasLegacy = hasArrayForAnyKey(legacyPayload, legacyKeys);
		if (hasLegacy) {
			setDatasetIfChanged(key, targetRef, readFirstArray(legacyPayload, legacyKeys));
			continue;
		}

		missingInCache.push(key);
	}

	// Keep strict 304 no-op safe: if cache lacks a dataset section, force a
	// one-time 200 re-fetch by dropping the stale etag for that section only.
	dropMenuEtags(missingInCache);
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
