import { ref } from 'vue';

const STATUS_DONE = 'Átvett';

export function useEmployeeOrderRealtimeEvents({
	loadOrders,
	normalizeOrderDto,
	upsertOrderIntoColumns,
	findOrderLocation,
	readText,
	toOrderId,
	savingStatus,
	isDragCooldown,
}) {
	const pendingRefresh = ref(false);
	const isDraggingOrder = ref(false);
	let pendingRefreshTimer = null;

	function clearPendingRefreshTimer() {
		if (pendingRefreshTimer == null) return;
		window.clearTimeout(pendingRefreshTimer);
		pendingRefreshTimer = null;
	}

	function schedulePendingRefreshFlush() {
		clearPendingRefreshTimer();
		if (!pendingRefresh.value) return;

		const needsDelay = isDraggingOrder.value || savingStatus.value || isDragCooldown();
		pendingRefreshTimer = window.setTimeout(async () => {
			pendingRefreshTimer = null;
			if (!pendingRefresh.value) return;
			if (isDraggingOrder.value || savingStatus.value || isDragCooldown()) {
				schedulePendingRefreshFlush();
				return;
			}

			pendingRefresh.value = false;
			await loadOrders();
		}, needsDelay ? 300 : 0);
	}

	function onOrderDragStart() {
		isDraggingOrder.value = true;
	}

	function onOrderDragEnd() {
		isDraggingOrder.value = false;
		if (pendingRefresh.value) schedulePendingRefreshFlush();
	}

	function handleOrderPlaced(payload) {
		if (isDraggingOrder.value) {
			pendingRefresh.value = true;
			schedulePendingRefreshFlush();
			return;
		}

		const normalized = normalizeOrderDto(payload);
		if (normalized) {
			upsertOrderIntoColumns(normalized);
			return;
		}
		void loadOrders();
	}

	function handleOrderUpdated(orderId, status) {
		const isObjectPayload = orderId && typeof orderId === 'object';
		const payload = isObjectPayload ? orderId : null;
		const resolvedOrderId = payload
			? payload?.id ?? payload?.Id ?? payload?.orderId ?? payload?.OrderId ?? payload?.rendelesId ?? payload?.RendelesId ?? payload?.order?.id ?? payload?.order?.Id
			: orderId;
		const idKey = toOrderId(resolvedOrderId);
		if (!idKey) return;

		if (isDraggingOrder.value || savingStatus.value || isDragCooldown()) {
			pendingRefresh.value = true;
			schedulePendingRefreshFlush();
			return;
		}

		const resolvedStatus = payload
			? payload?.statusz ?? payload?.Statusz ?? payload?.status ?? payload?.Status ?? payload?.order?.statusz ?? payload?.order?.Statusz ?? payload?.order?.status ?? payload?.order?.Status
			: status;
		const newStatus = readText(resolvedStatus);
		if (!newStatus) {
			void loadOrders();
			return;
		}

		const location = findOrderLocation(idKey);
		if (location?.order) {
			upsertOrderIntoColumns({ ...location.order, statusz: newStatus });
			return;
		}

		if (newStatus !== STATUS_DONE) {
			void loadOrders();
		}
	}

	return {
		pendingRefresh,
		isDraggingOrder,
		clearPendingRefreshTimer,
		schedulePendingRefreshFlush,
		onOrderDragStart,
		onOrderDragEnd,
		handleOrderPlaced,
		handleOrderUpdated,
	};
}
