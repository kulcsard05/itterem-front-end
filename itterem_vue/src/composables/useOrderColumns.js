import { computed, ref } from 'vue';
import { ORDER_STATUSES } from '../constants.js';

const STATUS_PENDING = ORDER_STATUSES[0];     // 'Függőben'
const STATUS_PROCESSING = ORDER_STATUSES[1]; // 'Folyamatban'
const STATUS_READY = ORDER_STATUSES[2];       // 'Átvehető'
const STATUS_DONE = ORDER_STATUSES[3];        // 'Átvett'

export function toOrderId(value) {
	return String(value ?? '').trim();
}

export function useOrderColumns({ selectedOrderId, selectedOrderSnapshot, normalizeOrderDto, readText }) {
	const pendingOrders = ref([]);
	const processingOrders = ref([]);
	const readyOrders = ref([]);

	const columnRefs = [pendingOrders, processingOrders, readyOrders];

	// O(1) lookup index: orderId -> { listRef, index, order }
	const orderIndex = new Map();

	function toStatus(value) {
		return readText(value);
	}

	function readList(listRef) {
		return Array.isArray(listRef?.value) ? listRef.value : [];
	}

	function rebuildIndex() {
		orderIndex.clear();
		for (const listRef of columnRefs) {
			const list = readList(listRef);
			for (let index = 0; index < list.length; index += 1) {
				const order = list[index];
				const orderId = toOrderId(order?.id);
				if (!orderId) continue;
				orderIndex.set(orderId, { listRef, index, order });
			}
		}
	}

	function findOrderLocation(orderId) {
		const idKey = toOrderId(orderId);
		if (!idKey) {
			return null;
		}

		const cached = orderIndex.get(idKey);
		if (cached) {
			const list = readList(cached.listRef);
			if (list[cached.index] === cached.order) {
				return cached;
			}
		}

		for (const listRef of columnRefs) {
			const list = readList(listRef);
			const index = list.findIndex((order) => toOrderId(order?.id) === idKey);
			if (index !== -1) {
				const location = { listRef, index, order: list[index] };
				orderIndex.set(idKey, location);
				return location;
			}
		}

		orderIndex.delete(idKey);
		return null;
	}

	function listRefForStatus(statusz) {
		const status = toStatus(statusz);
		if (status === STATUS_PROCESSING) return processingOrders;
		if (status === STATUS_READY) return readyOrders;
		return pendingOrders;
	}

	function removeOrderFromLists(orderId) {
		const loc = findOrderLocation(orderId);
		if (!loc) return null;
		const list = readList(loc.listRef);
		const removed = list.splice(loc.index, 1)[0] ?? null;
		rebuildIndex();
		return removed;
	}

	function upsertOrderIntoColumns(normalized) {
		if (!normalized) return;
		const idKey = toOrderId(normalized.id);
		if (!idKey) return;

		const loc = findOrderLocation(idKey);
		if (loc?.order) {
			const prevStatus = toStatus(loc.order?.statusz);
			const nextStatus = toStatus(normalized.statusz) || prevStatus || STATUS_PENDING;
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
				rebuildIndex();
			}

			if (String(selectedOrderId.value ?? '') === idKey) selectedOrderSnapshot.value = loc.order;
			return;
		}

		if (toStatus(normalized.statusz) === STATUS_DONE) return;
		const target = listRefForStatus(normalized.statusz);
		target.value.unshift(normalized);
		rebuildIndex();
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
			const status = toStatus(order?.statusz);
			if (status === STATUS_DONE) continue;
			if (status === STATUS_PROCESSING) processingOrders.value.push(order);
			else if (status === STATUS_READY) readyOrders.value.push(order);
			else pendingOrders.value.push(order);
		}
		rebuildIndex();
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
		const idKey = toOrderId(order?.id);
		if (!idKey) return;

		const target = listRefForStatus(targetStatus);
		const loc = findOrderLocation(idKey);

		if (loc && loc.listRef === target) return; // already correct

		// Remove from wrong column if present.
		if (loc) {
			const list = readList(loc.listRef);
			list.splice(loc.index, 1);
		}

		// Add to the correct column (at the front).
		target.value.unshift(order);
		rebuildIndex();
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
