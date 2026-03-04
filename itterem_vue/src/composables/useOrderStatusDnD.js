import { ref } from 'vue';

export function useOrderStatusDnD({ persistStatus, reloadOrders, pendingRefreshRef }) {
	const savingStatus = ref(false);

	async function onDraggableChange(event, newStatus) {
		const added = event?.added?.element;
		if (!added?.id) return;

		savingStatus.value = true;
		try {
			await persistStatus(added.id, newStatus);
			added.statusz = newStatus;
		} catch {
			await reloadOrders();
		} finally {
			savingStatus.value = false;
			if (pendingRefreshRef.value) {
				pendingRefreshRef.value = false;
				await reloadOrders();
			}
		}
	}

	return {
		savingStatus,
		onDraggableChange,
	};
}
