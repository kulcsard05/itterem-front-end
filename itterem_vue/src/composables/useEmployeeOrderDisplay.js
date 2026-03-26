import { computed, onScopeDispose, ref } from 'vue';
import { asArray } from '../shared/utils.js';

function formatElapsed(value, nowMs = Date.now()) {
	const date = new Date(value);
	const timestamp = date instanceof Date ? date.getTime() : NaN;
	if (!Number.isFinite(timestamp)) return '-';

	const diffMs = Math.max(0, nowMs - timestamp);
	const totalSeconds = Math.floor(diffMs / 1000);
	if (totalSeconds < 60) return `${totalSeconds} másodperce`;

	const totalMinutes = Math.floor(totalSeconds / 60);
	if (totalMinutes < 60) return `${totalMinutes} perce`;

	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (minutes === 0) return `${hours} órája`;

	return `${hours} órája ${minutes} perce`;
}

export function useEmployeeOrderDisplay({
	connectionState,
	SIGNALR_CONNECTION_STATE,
	selectedOrderId,
	toOrderId,
	getListRef,
}) {
	const nowMs = ref(Date.now());
	const clock = setInterval(() => {
		nowMs.value = Date.now();
	}, 1000);

	onScopeDispose(() => {
		clearInterval(clock);
	});

	function isOrderSelected(orderId) {
		return toOrderId(selectedOrderId.value) === toOrderId(orderId);
	}

	function getOrderCardItemCount(order) {
		return asArray(order?.rendelesElemeks).length;
	}

	function getOrderElapsedLabel(order) {
		return formatElapsed(order?.datum, nowMs.value);
	}

	function getOrderElapsedMinutes(order) {
		const date = new Date(order?.datum);
		const timestamp = date instanceof Date ? date.getTime() : NaN;
		if (!Number.isFinite(timestamp)) return 0;
		return Math.max(0, Math.floor((nowMs.value - timestamp) / 60000));
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
		getOrderElapsedMinutes,
		getColumnCount,
		realtimeIndicatorClass,
	};
}
