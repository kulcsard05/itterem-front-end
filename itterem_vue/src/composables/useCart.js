import { computed, ref } from 'vue';
import { getItemTypeLabel, getOrderItemIdKey } from '../utils.js';

// ---------------------------------------------------------------------------
// Module-level singleton so every component shares the same cart.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'cart';

function loadFromStorage() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function saveToStorage(items) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
	} catch {
		// ignore quota errors
	}
}

// items: Array<{ type: string, id: number, name: string, price: number|null, image: string, quantity: number }>
const items = ref(loadFromStorage());

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

		const typeLabel = String(itemData?.typeLabel ?? '').trim() || getItemTypeLabel(type);

		const existing = items.value.find((c) => c.type === type && c.id === id);
		if (existing) {
			existing.quantity += 1;
			if (!String(existing.typeLabel ?? '').trim()) existing.typeLabel = typeLabel;
		} else {
			items.value.push({
				type,
				typeLabel,
				id,
				name: String(itemData?.name ?? ''),
				price: itemData?.price ?? null,
				image: itemData?.image ?? '',
				quantity: 1,
			});
		}
		saveToStorage(items.value);
	}

	/**
	 * Remove one unit of an item from the cart.
	 */
	function decrementItem(type, id) {
		const idx = items.value.findIndex((c) => c.type === type && c.id === id);
		if (idx === -1) return;
		if (items.value[idx].quantity > 1) {
			items.value[idx].quantity -= 1;
		} else {
			items.value.splice(idx, 1);
		}
		saveToStorage(items.value);
	}

	/**
	 * Remove an item from the cart entirely regardless of quantity.
	 */
	function removeItem(type, id) {
		const idx = items.value.findIndex((c) => c.type === type && c.id === id);
		if (idx !== -1) items.value.splice(idx, 1);
		saveToStorage(items.value);
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
	 * @returns {Array<{[idKey: string]: number, mennyiseg: number}>}
	 */
	function buildOrderItems() {
		return items.value.map((item) => {
			const idKey = getOrderItemIdKey(item.type);
			return { [idKey]: item.id, mennyiseg: item.quantity };
		});
	}

	return {
		items,
		totalItems,
		totalPrice,
		addItem,
		decrementItem,
		removeItem,
		clearCart,
		buildOrderItems,
	};
}
