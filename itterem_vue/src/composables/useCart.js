import { computed, ref } from 'vue';
import { getItemTypeLabel, getOrderItemIdKey, toImageSrc } from '../utils.js';
import { readStorageText, writeStorageText } from '../storage-utils.js';
import { useMenuData } from './useMenuData.js';

// ---------------------------------------------------------------------------
// Module-level singleton so every component shares the same cart.
// ---------------------------------------------------------------------------

import { CART_STORAGE_KEY } from '../constants.js';

const STORAGE_KEY = CART_STORAGE_KEY;
const SESSION_FALLBACK_KEY = `${STORAGE_KEY}:session`;

// ---------------------------------------------------------------------------
// Menu data reference – lazily initialised to avoid order-of-init issues.
// ---------------------------------------------------------------------------
let _menuDataRef = null;

function getMenuData() {
	if (!_menuDataRef) {
		try {
			_menuDataRef = useMenuData();
		} catch {
			return null;
		}
	}
	return _menuDataRef;
}

// ---------------------------------------------------------------------------
// Serialisation – only persist { type, id, quantity } to save localStorage space.
// ---------------------------------------------------------------------------

function toSerializableItems(value) {
	const list = Array.isArray(value) ? value : [];
	return list
		.map((item) => ({
			type: String(item?.type ?? ''),
			id: item?.id,
			quantity: Number(item?.quantity ?? 0) || 0,
		}))
		.filter((item) => item.type && item.id != null && item.quantity > 0);
}

/**
 * Hydrate a slim stored item with display fields from the menu data store.
 */
function hydrateItem(slim) {
	try {
		const md = getMenuData();
		if (!md || typeof md.hydrateCartItem !== 'function') {
			throw new Error('Menu data hydrator unavailable');
		}
		return md.hydrateCartItem(slim);
	} catch {
		// Menu data not available yet – return with defaults.
		return {
			...slim,
			name: slim.name || '',
			price: slim.price ?? null,
			kep: slim.kep || '',
			typeLabel: slim.typeLabel || getItemTypeLabel(slim.type),
		};
	}
}

function parseStoredItems(raw) {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw);
		const slim = Array.isArray(parsed)
			? parsed
				.map((item) => ({
					type: String(item?.type ?? ''),
					id: item?.id,
					quantity: Number(item?.quantity ?? 0) || 0,
					// Accept legacy fields if present so existing carts still work.
					name: item?.name,
					price: item?.price,
					kep: item?.kep,
					typeLabel: item?.typeLabel,
				}))
				.filter((item) => item.type && item.id != null && item.quantity > 0)
			: null;
		if (!slim || slim.length === 0) return null;
		return slim.map(hydrateItem);
	} catch {
		return null;
	}
}

function loadFromStorage() {
	// Primary: localStorage
	const localItems = parseStoredItems(
		readStorageText(STORAGE_KEY, { storage: localStorage, fallback: null }),
	);
	if (localItems) return localItems;

	// Fallback: sessionStorage (still survives page refresh in the same tab)
	const sessionItems = parseStoredItems(
		readStorageText(SESSION_FALLBACK_KEY, { storage: sessionStorage, fallback: null }),
	);
	if (sessionItems) return sessionItems;

	return [];
}

function saveToStorage(items) {
	const snapshot = toSerializableItems(items);
	const serialized = JSON.stringify(snapshot);
	const localSaved = writeStorageText(STORAGE_KEY, serialized, {
		storage: localStorage,
		context: '[Cart]',
	});

	const localPersisted =
		localSaved &&
		readStorageText(STORAGE_KEY, { storage: localStorage, fallback: null }) === serialized;

	// Keep a same-tab fallback so refresh does not lose cart when localStorage is blocked.
	writeStorageText(SESSION_FALLBACK_KEY, serialized, {
		storage: sessionStorage,
		warnOnError: false,
	});

	if (!localPersisted) {
		console.warn('[Cart] localStorage write failed; using session fallback persistence.');
	}
}

// items: Array<{ type: string, id: number, name: string, price: number|null, image: string, quantity: number }>
const items = ref(loadFromStorage());

// Cart mutations are centralized in this composable and persist immediately,
// so a global deep watcher would only cause redundant writes.

// Note: mapping lives in utils.js so UI and API stay consistent.

export function useCart() {
	// -------------------------------------------------------------------------
	// Derived
	// -------------------------------------------------------------------------

	const totalItems = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0));

	const totalPrice = computed(() =>
		items.value.reduce((sum, item) => {
			const price = item.price ?? 0;
			return sum + price * item.quantity;
		}, 0),
	);

	/** Resolve the raw kep key to a displayable image src at render time. */
	function resolveImage(item) {
		return toImageSrc(item?.kep);
	}

	// -------------------------------------------------------------------------
	// Mutations
	// -------------------------------------------------------------------------

	/**
	 * Add an item to the cart (or increment its quantity if already present).
	 * @param {{ type: string, id: number, name: string, price?: number|null, image?: string }} itemData
	 */
	function addItem(itemData) {
		const type = String(itemData?.type ?? '');
		const id = itemData?.id ?? itemData?.item?.id;

		if (!id || !getOrderItemIdKey(type)) return;

		// Extract the raw kep key – prefer the original item's .kep so we never
		// store a resolved data-URL / base64 blob in localStorage.
		const rawKep = String(itemData?.item?.kep ?? itemData?.kep ?? '');

		const typeLabel = String(itemData?.typeLabel ?? '').trim() || getItemTypeLabel(type);
		const list = items.value;
		const existing = list.find((c) => c.type === type && c.id === id);
		if (existing) {
			existing.quantity += 1;
			if (!String(existing.typeLabel ?? '').trim()) existing.typeLabel = typeLabel;
		} else {
			list.push({
				type,
				typeLabel,
				id,
				name: String(itemData?.name ?? ''),
				price: itemData?.price ?? null,
				kep: rawKep,
				quantity: 1,
			});
		}
		saveToStorage(list);
	}

	/**
	 * Remove one unit of an item from the cart.
	 */
	function decrementItem(type, id) {
		const list = items.value;
		const idx = list.findIndex((c) => c.type === type && c.id === id);
		if (idx === -1) return;
		if (list[idx].quantity > 1) {
			list[idx].quantity -= 1;
		} else {
			list.splice(idx, 1);
		}
		saveToStorage(list);
	}

	/**
	 * Remove an item from the cart entirely regardless of quantity.
	 */
	function removeItem(type, id) {
		const list = items.value;
		const idx = list.findIndex((c) => c.type === type && c.id === id);
		if (idx !== -1) list.splice(idx, 1);
		saveToStorage(list);
	}

	/**
	 * Empty the cart.
	 */
	function clearCart() {
		items.value = [];
		saveToStorage([]);
	}

	/**
	 * Build the `items` array for the ordering API payload.
	 * Items whose type has no known API id-key are skipped with a warning.
	 * @returns {Array<{[idKey: string]: number, mennyiseg: number}>}
	 */
	function buildOrderItems() {
		const result = [];
		for (const item of items.value) {
			const idKey = getOrderItemIdKey(item.type);
			if (!idKey) {
				console.warn(`[Cart] Unknown item type "${item.type}" — skipped from order payload.`);
				continue;
			}
			result.push({ [idKey]: item.id, mennyiseg: item.quantity });
		}
		return result;
	}

	/**
	 * Re-hydrate all in-memory cart items from the current menu data.
	 * Call this after menu data has been fetched/loaded so that items loaded
	 * from storage (which only have type + id + quantity) get their display
	 * fields (name, price, kep, typeLabel) populated.
	 */
	function rehydrateItems() {
		const md = getMenuData();
		if (!md) return;
		for (const item of items.value) {
			const hydrated = md.hydrateCartItem(item);
			if (hydrated.name) item.name = hydrated.name;
			if (hydrated.price != null) item.price = hydrated.price;
			if (hydrated.kep) item.kep = hydrated.kep;
			if (hydrated.typeLabel) item.typeLabel = hydrated.typeLabel;
		}
	}

	return {
		items,
		totalItems,
		totalPrice,
		resolveImage,
		addItem,
		decrementItem,
		removeItem,
		clearCart,
		buildOrderItems,
		rehydrateItems,
	};
}
