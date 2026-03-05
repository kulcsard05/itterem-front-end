import { ref } from 'vue';

const DRAG_COOLDOWN_MS = 4000;

export function useOrderStatusDnD({ persistStatus, reloadOrders, pendingRefreshRef, ensureOrderInColumn, onError }) {
	const savingStatus = ref(false);

	// Timestamp of the last successful drag save.
	// Used to suppress reloads that could race the server commit.
	let lastDragTime = 0;

	function isDragCooldown() {
		return Date.now() - lastDragTime < DRAG_COOLDOWN_MS;
	}

	async function onDraggableChange(event, newStatus) {
		const added = event?.added?.element;
		if (!added?.id) return;

		// Safety net: ensure vuedraggable actually placed the item in the
		// correct column.  No-op when the splice already succeeded.
		ensureOrderInColumn(added, newStatus);

		savingStatus.value = true;
		try {
			await persistStatus(added.id, newStatus);
			added.statusz = newStatus;
			lastDragTime = Date.now();
		} catch (err) {
			if (typeof onError === 'function') {
				onError(err?.message || 'Státusz mentése sikertelen.');
			}
			await reloadOrders();
		} finally {
			savingStatus.value = false;
			pendingRefreshRef.value = false;
		}
	}

	return {
		savingStatus,
		onDraggableChange,
		isDragCooldown,
	};
}
