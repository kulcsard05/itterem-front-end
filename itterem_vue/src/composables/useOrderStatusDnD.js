import { ref } from 'vue';

const DRAG_COOLDOWN_MS = 4000;

export function useOrderStatusDnD({ persistStatus, reloadOrders, ensureOrderInColumn, onError }) {
	const savingStatus = ref(false);

	// Timestamp of the last successful drag save.
	// Used to suppress reloads that could race the server commit.
	let lastDragTime = 0;

	function isDragCooldown() {
		return Date.now() - lastDragTime < DRAG_COOLDOWN_MS;
	}

	function readOrderId(order) {
		return order?.id ?? order?.Id ?? order?.rendelesId ?? order?.RendelesId ?? null;
	}

	async function onDraggableChange(event, newStatus) {
		const added = event?.added?.element;
		// vuedraggable emits change for removed/moved events as well.
		// We only persist when an item is added to a target status column.
		if (!added) return;

		const orderId = readOrderId(added);
		if (orderId == null || String(orderId).trim() === '') {
			if (typeof onError === 'function') {
				onError('Hiányzó rendelés azonosító, a státusz nem menthető.');
			}
			await reloadOrders();
			return;
		}

		if (added && added.statusz == null && added.Statusz != null) {
			added.statusz = added.Statusz;
		}

		// Safety net: ensure vuedraggable actually placed the item in the
		// correct column.  No-op when the splice already succeeded.
		ensureOrderInColumn(added, newStatus);

		savingStatus.value = true;
		try {
			await persistStatus(orderId, newStatus);
			added.statusz = newStatus;
			await reloadOrders();
			lastDragTime = Date.now();
		} catch (err) {
			if (typeof onError === 'function') {
				onError(err?.message || 'Státusz mentése sikertelen.');
			}
			await reloadOrders();
		} finally {
			savingStatus.value = false;
		}
	}

	return {
		savingStatus,
		onDraggableChange,
		isDragCooldown,
	};
}
