import { computed, ref } from 'vue';

export function useOrderColumns({ selectedOrderId, selectedOrderSnapshot, normalizeOrderDto, readText }) {
	const pendingOrders = ref([]);
	const processingOrders = ref([]);
	const readyOrders = ref([]);

	function findOrderLocation(orderId) {
		const idKey = String(orderId ?? '').trim();
		if (!idKey) return null;

		const lists = [
			{ ref: pendingOrders },
			{ ref: processingOrders },
			{ ref: readyOrders },
		];

		for (const list of lists) {
			const arr = Array.isArray(list.ref.value) ? list.ref.value : [];
			const idx = arr.findIndex((o) => String(o?.id ?? '').trim() === idKey);
			if (idx !== -1) return { listRef: list.ref, index: idx, order: arr[idx] };
		}

		return null;
	}

	function listRefForStatus(statusz) {
		const status = readText(statusz);
		if (status === 'Folyamatban') return processingOrders;
		if (status === 'Átvehető') return readyOrders;
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

			if (nextStatus === 'Teljesítve') {
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

		if (readText(normalized.statusz) === 'Teljesítve') return;
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
			if (status === 'Teljesítve') continue;
			if (status === 'Folyamatban') processingOrders.value.push(order);
			else if (status === 'Átvehető') readyOrders.value.push(order);
			else pendingOrders.value.push(order);
		}
	}

	function getListRef(key) {
		if (key === 'pending') return pendingOrders;
		if (key === 'processing') return processingOrders;
		return readyOrders;
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
	};
}
