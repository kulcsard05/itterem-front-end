import { reactive } from 'vue';
import { ORDER_STATUSES } from '../config/constants.js';

export function useEmployeeOrderBoardColumns() {
	const columnOpen = reactive({
		pending: true,
		processing: true,
		ready: true,
	});

	const columns = [
		{ key: 'pending', label: ORDER_STATUSES[0], status: ORDER_STATUSES[0], headerClass: 'bg-orange-50' },
		{ key: 'processing', label: ORDER_STATUSES[1], status: ORDER_STATUSES[1], headerClass: 'bg-yellow-50' },
		{ key: 'ready', label: ORDER_STATUSES[2], status: ORDER_STATUSES[2], headerClass: 'bg-green-50' },
	];

	function toggleColumn(key) {
		columnOpen[key] = !columnOpen[key];
	}

	return {
		columnOpen,
		columns,
		toggleColumn,
	};
}
