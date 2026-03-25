import { ref } from 'vue';
import { extractOrderUpdateEvent } from '../domain/order/order-dto.js';
import { ORDER_STATUS_DONE, toOrderId as toOrderIdDefault } from '../domain/order/order-utils.js';

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

	function handleOrderUpdated(firstArg, secondArg, thirdArg) {
		const { orderId, status } = extractOrderUpdateEvent([firstArg, secondArg, thirdArg]);
		const idKey = (typeof toOrderId === 'function' ? toOrderId : toOrderIdDefault)(orderId);
		if (!idKey) return;

		const newStatus = readText(status);
		if (!newStatus) {
			void loadOrders();
			return;
		}

		const location = findOrderLocation(idKey);
		if (location?.order) {
			upsertOrderIntoColumns({ ...location.order, statusz: newStatus });
			return;
		}

		if (newStatus !== ORDER_STATUS_DONE) {
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
