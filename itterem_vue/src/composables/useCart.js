import { computed, ref } from 'vue';

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

/**
 * Map a cart item type to the correct id key expected by the ordering API.
 */
function typeToIdKey(type) {
	switch (String(type).toLowerCase()) {
		case 'meals':
		case 'meal':
			return 'keszetelId';
		case 'drinks':
		case 'drink':
			return 'uditoId';
		case 'menus':
		case 'menu':
			return 'menuId';
		case 'sides':
		case 'side':
			return 'koretId';
		default:
			return null;
	}
}

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

		if (!id || !typeToIdKey(type)) return;

		const existing = items.value.find((c) => c.type === type && c.id === id);
		if (existing) {
			existing.quantity += 1;
		} else {
			items.value.push({
				type,
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
			const idKey = typeToIdKey(item.type);
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
