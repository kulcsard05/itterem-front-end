import { onMounted, onUnmounted } from 'vue';
import { SIGNALR_CONNECTION_STATE, useSignalR } from './useSignalR.js';

export function useEmployeeOrdersBoot({
	initializePanel,
	cleanupPanel,
	loadOrders,
	loadCatalog,
	onOrderPlaced,
	onOrderUpdated,
	savingStatus,
	isDragCooldown,
	isDraggingRef,
	connectionState,
	pollIntervalMs,
	authExpiredEvent,
}) {
	let pollTimer = null;
	const { start, stop, on } = useSignalR();
	let unsubPlaced = null;
	let unsubUpdated = null;

	function handleAuthExpired() {
		void stop();
	}

	onMounted(async () => {
		initializePanel();

		await Promise.all([loadOrders(), loadCatalog()]);

		pollTimer = window.setInterval(() => {
			if (isDraggingRef?.value) return;
			if (savingStatus.value) return;
			if (typeof isDragCooldown === 'function' && isDragCooldown()) return;
			if (connectionState.value === SIGNALR_CONNECTION_STATE.CONNECTING) {
				return;
			}
			// Reconcile periodically even when SignalR is connected.
			// This heals occasional dropped realtime events.
			void loadOrders();
		}, pollIntervalMs);

		unsubPlaced = on('OrderPlaced', onOrderPlaced);
		unsubUpdated = on('OrderUpdated', onOrderUpdated);

		void start();

		try {
			window.addEventListener(authExpiredEvent, handleAuthExpired);
		} catch {
			// ignore
		}
	});

	onUnmounted(() => {
		if (unsubPlaced) unsubPlaced();
		if (unsubUpdated) unsubUpdated();
		void stop();
		try {
			window.removeEventListener(authExpiredEvent, handleAuthExpired);
		} catch {
			// ignore
		}
		cleanupPanel();
		if (pollTimer != null) window.clearInterval(pollTimer);
	});
}
