import { computed } from 'vue';
import { asArray } from '../utils.js';

function formatElapsed(value) {
	const date = new Date(value);
	const timestamp = date instanceof Date ? date.getTime() : NaN;
	if (!Number.isFinite(timestamp)) return '-';

	const diffMs = Math.max(0, Date.now() - timestamp);
	const totalMinutes = Math.floor(diffMs / 60000);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	if (hours <= 0) return `${minutes}p`;
	return `${hours}ó ${minutes}p`;
}

export function useEmployeeOrderDisplay({
	connectionState,
	SIGNALR_CONNECTION_STATE,
	selectedOrderId,
	toOrderId,
	getListRef,
}) {
	function isOrderSelected(orderId) {
		return toOrderId(selectedOrderId.value) === toOrderId(orderId);
	}

	function getOrderCardItemCount(order) {
		return asArray(order?.rendelesElemeks).length;
	}

	function getOrderElapsedLabel(order) {
		return formatElapsed(order?.datum);
	}

	function getColumnCount(columnKey) {
		return getListRef(columnKey).value.length;
	}

	const realtimeIndicatorClass = computed(() => {
		if (connectionState.value === SIGNALR_CONNECTION_STATE.CONNECTED) return 'bg-green-500';
		if (
			connectionState.value === SIGNALR_CONNECTION_STATE.CONNECTING
			|| connectionState.value === SIGNALR_CONNECTION_STATE.RECONNECTING
		) {
			return 'bg-yellow-500';
		}
		return 'bg-red-500';
	});

	return {
		formatElapsed,
		isOrderSelected,
		getOrderCardItemCount,
		getOrderElapsedLabel,
		getColumnCount,
		realtimeIndicatorClass,
	};
}
