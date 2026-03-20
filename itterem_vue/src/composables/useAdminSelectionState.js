import { computed, ref } from 'vue';
import { normalizeId } from '../utils.js';

const EMPTY_BULK_CAPABILITIES = Object.freeze({
	canDelete: false,
	supportsAvailability: false,
	supportsPrice: false,
	supportsStatus: false,
});

export function useAdminSelectionState({
	currentTabItems,
	activeEntityConfig,
	isLoading,
	saving,
	bulkSaving,
	bulkDeleteLoading,
	deleting,
}) {
	const selectedIds = ref([]);

	const selectedIdSet = computed(() =>
		new Set(selectedIds.value.map((id) => normalizeId(id)).filter(Boolean)),
	);

	const selectedItems = computed(() =>
		currentTabItems.value.filter((item) => selectedIdSet.value.has(normalizeId(item?.id))),
	);

	const selectedCount = computed(() => selectedItems.value.length);
	const allSelected = computed(() =>
		currentTabItems.value.length > 0 && selectedCount.value === currentTabItems.value.length,
	);
	const someSelected = computed(() => selectedCount.value > 0 && !allSelected.value);

	const activeBulkCapabilities = computed(
		() => activeEntityConfig.value?.bulk ?? EMPTY_BULK_CAPABILITIES,
	);

	const canBulkEdit = computed(
		() =>
			Boolean(
				activeBulkCapabilities.value.supportsAvailability
				|| activeBulkCapabilities.value.supportsPrice
				|| activeBulkCapabilities.value.supportsStatus,
			),
	);

	const canBulkDelete = computed(() => Boolean(activeBulkCapabilities.value.canDelete));

	const selectionBusy = computed(
		() =>
			isLoading.value
			|| saving.value
			|| bulkSaving.value
			|| bulkDeleteLoading.value
			|| deleting.value,
	);

	const bulkActionHint = computed(() => {
		if (activeBulkCapabilities.value.supportsStatus) {
			return 'Tömeges státuszváltás és törlés érhető el.';
		}
		if (
			activeBulkCapabilities.value.supportsAvailability
			&& activeBulkCapabilities.value.supportsPrice
		) {
			return 'Ár és elérhetőség módosítható tömegesen, más mező nem.';
		}
		if (canBulkDelete.value) {
			return 'Ehhez a típushoz csak tömeges törlés érhető el.';
		}
		return '';
	});

	function clearSelection() {
		selectedIds.value = [];
	}

	function reconcileSelection() {
		const allowedIds = new Set(
			currentTabItems.value
				.map((item) => normalizeId(item?.id))
				.filter(Boolean),
		);
		selectedIds.value = selectedIds.value.filter((id) => allowedIds.has(normalizeId(id)));
	}

	function toggleSelectAll(checked) {
		selectedIds.value = checked
			? currentTabItems.value
				.map((item) => normalizeId(item?.id))
				.filter(Boolean)
			: [];
	}

	function toggleSelectItem({ item, selected }) {
		const itemId = normalizeId(item?.id);
		if (!itemId) return;

		const nextSelected = new Set(selectedIds.value.map((id) => normalizeId(id)).filter(Boolean));
		if (selected) nextSelected.add(itemId);
		else nextSelected.delete(itemId);
		selectedIds.value = Array.from(nextSelected);
	}

	return {
		selectedIds,
		selectedItems,
		selectedCount,
		allSelected,
		someSelected,
		activeBulkCapabilities,
		canBulkEdit,
		canBulkDelete,
		selectionBusy,
		bulkActionHint,
		clearSelection,
		reconcileSelection,
		toggleSelectAll,
		toggleSelectItem,
	};
}
