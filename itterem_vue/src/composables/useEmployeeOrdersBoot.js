import { onMounted, onUnmounted, watch } from 'vue';
import { useSignalR } from './useSignalR.js';

export function useEmployeeOrdersBoot({
	initializePanel,
	cleanupPanel,
	loadOrders,
	loadCatalog,
	onOrderPlaced,
	onOrderUpdated,
	savingStatus,
	isDragCooldown,
	connectionState,
	pollIntervalMs,
	authExpiredEvent,
	watchToken,
}) {
	let pollTimer = null;
	const { start, stop, on } = useSignalR();
	let unsubPlaced = null;
	let unsubUpdated = null;

	function handleAuthExpired() {
		stop();
	}

	onMounted(async () => {
		initializePanel();

		await Promise.all([loadOrders(), loadCatalog()]);

		pollTimer = window.setInterval(() => {
			if (savingStatus.value) return;
			if (typeof isDragCooldown === 'function' && isDragCooldown()) return;
			if (connectionState.value === 'connected' || connectionState.value === 'connecting') return;
			loadOrders();
		}, pollIntervalMs);

		unsubPlaced = on('OrderPlaced', onOrderPlaced);
		unsubUpdated = on('OrderUpdated', onOrderUpdated);

		start();

		try {
			window.addEventListener(authExpiredEvent, handleAuthExpired);
		} catch {
			// ignore
		}
	});

	onUnmounted(() => {
		if (unsubPlaced) unsubPlaced();
		if (unsubUpdated) unsubUpdated();
		stop();
		try {
			window.removeEventListener(authExpiredEvent, handleAuthExpired);
		} catch {
			// ignore
		}
		cleanupPanel();
		if (pollTimer != null) window.clearInterval(pollTimer);
	});

	watch(watchToken, () => {
		start();
	});
}
