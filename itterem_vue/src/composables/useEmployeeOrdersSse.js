import { ref } from 'vue';
import { startFetchSse } from './useFetchSse.js';

export function useEmployeeOrdersSse({
	getToken,
	buildUrl,
	onRefreshFromSse,
	onUpsertOrders,
	onNormalizeOrder,
	onUpsertOrder,
	onMarkOrder,
	onExtractOrderId,
	onExtractOrderStatus,
	onApplyStatusUpdate,
	maxReconnectDelay,
	baseReconnectDelay,
	maxReconnectExponent,
	openWatchdogTimeout,
}) {
	const sseState = ref('disabled'); // disabled | connecting | open | error
	const sseLastEventAt = ref(null);
	const sseLastEventLabel = ref('');
	const sseLastError = ref('');

	let sseClient = null;
	let ordersSseAbortController = null;
	let statusSseAbortController = null;
	let sseReconnectTimer = null;
	let sseReconnectAttempt = 0;
	let sseOpenWatchdogTimer = null;

	function stopEmployeeSse() {
		if (sseOpenWatchdogTimer != null) {
			window.clearTimeout(sseOpenWatchdogTimer);
			sseOpenWatchdogTimer = null;
		}
		if (sseReconnectTimer != null) {
			window.clearTimeout(sseReconnectTimer);
			sseReconnectTimer = null;
		}
		if (ordersSseAbortController) {
			try {
				ordersSseAbortController.abort();
			} catch {
				// ignore
			}
			ordersSseAbortController = null;
		}
		if (statusSseAbortController) {
			try {
				statusSseAbortController.abort();
			} catch {
				// ignore
			}
			statusSseAbortController = null;
		}
		if (sseClient) {
			try {
				sseClient.close();
			} catch {
				// ignore
			}
			sseClient = null;
		}
	}

	function scheduleSseReconnect() {
		if (sseReconnectTimer != null) return;
		sseReconnectAttempt += 1;
		const delay = Math.min(
			maxReconnectDelay,
			baseReconnectDelay * 2 ** Math.min(maxReconnectExponent, sseReconnectAttempt),
		);
		sseReconnectTimer = window.setTimeout(() => {
			sseReconnectTimer = null;
			startEmployeeSse();
		}, delay);
	}

	function startEmployeeSse() {
		const token = getToken();
		if (!token) {
			sseState.value = 'disabled';
			sseLastError.value = '';
			return;
		}

		const url = buildUrl('/api/Rendelesek/stream');
		if (!url) return;

		stopEmployeeSse();
		sseLastError.value = '';
		sseState.value = 'connecting';

		sseOpenWatchdogTimer = window.setTimeout(() => {
			if (sseState.value !== 'connecting') return;
			sseState.value = 'error';
			sseLastError.value = 'SSE nem nyílt meg (polling fallback)';
			try {
				sseClient?.close?.();
			} catch {
				// ignore
			}
			sseClient = null;
		}, openWatchdogTimeout);

		sseClient = {
			close: () => {
				try {
					ordersSseAbortController?.abort();
				} catch {
					// ignore
				}
			},
		};

		startFetchSse({
			url,
			token,
			onController: (controller) => {
				ordersSseAbortController = controller;
			},
			onOpen: () => {
				if (sseOpenWatchdogTimer != null) {
					window.clearTimeout(sseOpenWatchdogTimer);
					sseOpenWatchdogTimer = null;
				}
				sseState.value = 'open';
				sseReconnectAttempt = 0;
				sseLastEventAt.value = Date.now();
				sseLastEventLabel.value = 'SSE kapcsolódva';
			},
			onMessage: async (event) => {
				sseState.value = 'open';
				sseLastError.value = '';

				const raw = String(event?.data ?? '').trim();
				if (!raw) {
					await onRefreshFromSse({ label: event?.event ? `SSE ${event.event}` : 'SSE ping' });
					return;
				}

				let payload = null;
				try {
					payload = JSON.parse(raw);
				} catch {
					payload = raw;
				}

				sseLastEventAt.value = Date.now();
				sseLastEventLabel.value = event?.event ? `SSE ${event.event}` : 'SSE frissítés';

				if (Array.isArray(payload)) {
					onUpsertOrders(payload);
					for (const o of payload) onMarkOrder(o?.id ?? o?.Id);
					return;
				}

				const orders = payload?.orders ?? payload?.Orders ?? null;
				if (Array.isArray(orders)) {
					onUpsertOrders(orders);
					for (const o of orders) onMarkOrder(o?.id ?? o?.Id);
					return;
				}

				const maybeOrder = onNormalizeOrder(payload);
				if (maybeOrder) {
					onUpsertOrder(maybeOrder);
					onMarkOrder(maybeOrder.id);
					return;
				}

				const orderId = onExtractOrderId(payload);
				await onRefreshFromSse({ orderId, label: sseLastEventLabel.value || 'SSE frissítés' });
			},
			onError: (err) => {
				if (sseOpenWatchdogTimer != null) {
					window.clearTimeout(sseOpenWatchdogTimer);
					sseOpenWatchdogTimer = null;
				}
				sseState.value = 'error';
				const message = String(err?.message ?? '').trim();
				sseLastError.value = message
					? `SSE hiba: ${message} (újracsatlakozás...)`
					: 'SSE kapcsolat hiba (újracsatlakozás...)';
				sseClient = null;
				scheduleSseReconnect();
			},
		});
	}

	function startEmployeeStatusSse() {
		const token = getToken();
		if (!token) return;

		if (statusSseAbortController) {
			try {
				statusSseAbortController.abort();
			} catch {
				// ignore
			}
			statusSseAbortController = null;
		}

		const url = buildUrl('/api/Rendelesek/status-stream');
		if (!url) return;

		startFetchSse({
			url,
			token,
			onController: (controller) => {
				statusSseAbortController = controller;
			},
			onMessage: async (event) => {
				const raw = String(event?.data ?? '').trim();
				if (!raw) return;

				let payload = null;
				try {
					payload = JSON.parse(raw);
				} catch {
					payload = raw;
				}

				const orderId = onExtractOrderId(payload);
				const status = onExtractOrderStatus(payload);
				if (!orderId || !status) return;
				await onApplyStatusUpdate(orderId, status, event?.event ? `SSE ${event.event}` : 'SSE státusz');
			},
			onError: () => {
				// Non-fatal: main stream + polling continue to keep board updated.
			},
		});
	}

	return {
		sseState,
		sseLastEventAt,
		sseLastEventLabel,
		sseLastError,
		startEmployeeSse,
		startEmployeeStatusSse,
		stopEmployeeSse,
	};
}
