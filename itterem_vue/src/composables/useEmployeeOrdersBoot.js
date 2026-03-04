import { onMounted, onUnmounted, watch } from 'vue';

export function useEmployeeOrdersBoot({
	initializePanel,
	cleanupPanel,
	loadOrders,
	loadCatalog,
	startEmployeeSse,
	startEmployeeStatusSse,
	stopEmployeeSse,
	savingStatus,
	sseState,
	pollIntervalMs,
	authExpiredEvent,
	watchToken,
}) {
	let pollTimer = null;

	onMounted(async () => {
		initializePanel();

		await Promise.all([loadOrders(), loadCatalog()]);

		pollTimer = window.setInterval(() => {
			if (savingStatus.value) return;
			if (sseState.value === 'open' || sseState.value === 'connecting') return;
			loadOrders();
		}, pollIntervalMs);

		startEmployeeSse();
		startEmployeeStatusSse();

		try {
			window.addEventListener(authExpiredEvent, stopEmployeeSse);
		} catch {
			// ignore
		}
	});

	onUnmounted(() => {
		stopEmployeeSse();
		try {
			window.removeEventListener(authExpiredEvent, stopEmployeeSse);
		} catch {
			// ignore
		}
		cleanupPanel();
		if (pollTimer != null) window.clearInterval(pollTimer);
	});

	watch(watchToken, () => {
		startEmployeeSse();
		startEmployeeStatusSse();
	});
}
