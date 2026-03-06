import { computed, ref } from 'vue';
import { ORDER_STATUSES } from '../constants.js';

const STATUS_PENDING = ORDER_STATUSES[0];     // 'Függőben'
const STATUS_PROCESSING = ORDER_STATUSES[1]; // 'Folyamatban'
const STATUS_READY = ORDER_STATUSES[2];       // 'Átvehető'
const STATUS_DONE = ORDER_STATUSES[3];        // 'Átvett'

export function useOrderColumns({ selectedOrderId, selectedOrderSnapshot, normalizeOrderDto, readText }) {
	const pendingOrders = ref([]);
	const processingOrders = ref([]);
	const readyOrders = ref([]);

	// O(1) lookup index: orderId → { listRef, index }
	const _orderIndex = new Map();

	function _rebuildIndex() {
		_orderIndex.clear();
		const lists = [
			{ ref: pendingOrders },
			{ ref: processingOrders },
			{ ref: readyOrders },
		];
		for (const list of lists) {
			const arr = Array.isArray(list.ref.value) ? list.ref.value : [];
			for (let i = 0; i < arr.length; i++) {
				const key = String(arr[i]?.id ?? '').trim();
				if (key) _orderIndex.set(key, { listRef: list.ref, index: i, order: arr[i] });
			}
		}
	}

	function findOrderLocation(orderId) {
		const idKey = String(orderId ?? '').trim();
		if (!idKey) return null;

		// Try the index first (O(1)).
		const cached = _orderIndex.get(idKey);
		if (cached) {
			// Verify it's still valid (array mutation may have shifted indices).
			const arr = Array.isArray(cached.listRef.value) ? cached.listRef.value : [];
			if (arr[cached.index] === cached.order) return cached;
		}

		// Fallback: linear scan and update the index.
		const lists = [
			{ ref: pendingOrders },
			{ ref: processingOrders },
			{ ref: readyOrders },
		];

		for (const list of lists) {
			const arr = Array.isArray(list.ref.value) ? list.ref.value : [];
			const idx = arr.findIndex((o) => String(o?.id ?? '').trim() === idKey);
			if (idx !== -1) {
				const loc = { listRef: list.ref, index: idx, order: arr[idx] };
				_orderIndex.set(idKey, loc);
				return loc;
			}
		}

		_orderIndex.delete(idKey);
		return null;
	}

	function listRefForStatus(statusz) {
		const status = readText(statusz);
		if (status === STATUS_PROCESSING) return processingOrders;
		if (status === STATUS_READY) return readyOrders;
		return pendingOrders;
	}

	function removeOrderFromLists(orderId) {
		const loc = findOrderLocation(orderId);
		if (!loc) return null;
		const arr = Array.isArray(loc.listRef.value) ? loc.listRef.value : [];
		return arr.splice(loc.index, 1)[0] ?? null;
	}

	function upsertOrderIntoColumns(normalized) {
		if (!normalized) return;
		const idKey = String(normalized.id ?? '').trim();
		if (!idKey) return;

		const loc = findOrderLocation(idKey);
		if (loc?.order) {
			const prevStatus = readText(loc.order?.statusz);
			const nextStatus = readText(normalized.statusz) || prevStatus || 'Függőben';
			const merged = {
				...loc.order,
				...normalized,
				statusz: nextStatus,
			};
			Object.assign(loc.order, merged);

			if (nextStatus === STATUS_DONE) {
				removeOrderFromLists(idKey);
				if (String(selectedOrderId.value ?? '') === idKey) selectedOrderSnapshot.value = merged;
				return;
			}

			if (prevStatus !== nextStatus) {
				const moved = removeOrderFromLists(idKey) ?? merged;
				const target = listRefForStatus(nextStatus);
				target.value.unshift(moved);
			}

			if (String(selectedOrderId.value ?? '') === idKey) selectedOrderSnapshot.value = loc.order;
			return;
		}

		if (readText(normalized.statusz) === STATUS_DONE) return;
		const target = listRefForStatus(normalized.statusz);
		target.value.unshift(normalized);
		if (String(selectedOrderId.value ?? '') === idKey) selectedOrderSnapshot.value = normalized;
	}

	function upsertOrdersIntoColumns(incomingList) {
		const items = Array.isArray(incomingList) ? incomingList : [];
		for (const dto of items) {
			const normalized = normalizeOrderDto(dto);
			upsertOrderIntoColumns(normalized);
		}
	}

	function normalizeOrders(list) {
		pendingOrders.value = [];
		processingOrders.value = [];
		readyOrders.value = [];

		const items = Array.isArray(list) ? list : [];
		for (const order of items) {
			const status = String(order?.statusz ?? '').trim();
			if (status === STATUS_DONE) continue;
			if (status === STATUS_PROCESSING) processingOrders.value.push(order);
			else if (status === STATUS_READY) readyOrders.value.push(order);
			else pendingOrders.value.push(order);
		}
		_rebuildIndex();
	}

	function getListRef(key) {
		if (key === 'pending') return pendingOrders;
		if (key === 'processing') return processingOrders;
		return readyOrders;
	}

	/**
	 * Ensure an order is in the column matching `targetStatus`.
	 * No-op if it's already there; fixes it otherwise.
	 */
	function ensureOrderInColumn(order, targetStatus) {
		const idKey = String(order?.id ?? '').trim();
		if (!idKey) return;

		const target = listRefForStatus(targetStatus);
		const loc = findOrderLocation(idKey);

		if (loc && loc.listRef === target) return; // already correct

		// Remove from wrong column if present.
		if (loc) {
			const arr = Array.isArray(loc.listRef.value) ? loc.listRef.value : [];
			arr.splice(loc.index, 1);
		}

		// Add to the correct column (at the front).
		target.value.unshift(order);
	}

	const allOrders = computed(() => [
		...(Array.isArray(pendingOrders.value) ? pendingOrders.value : []),
		...(Array.isArray(processingOrders.value) ? processingOrders.value : []),
		...(Array.isArray(readyOrders.value) ? readyOrders.value : []),
	]);

	return {
		pendingOrders,
		processingOrders,
		readyOrders,
		allOrders,
		normalizeOrders,
		findOrderLocation,
		listRefForStatus,
		removeOrderFromLists,
		upsertOrderIntoColumns,
		upsertOrdersIntoColumns,
		getListRef,
		ensureOrderInColumn,
	};
}
