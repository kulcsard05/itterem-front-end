<script setup>
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import { getMealById } from '../../api.js';
import { useAdminBulkActionEngine } from '../../composables/useAdminBulkActionEngine.js';
import { useAdminBulkFailurePrompt } from '../../composables/useAdminBulkFailurePrompt.js';
import { useAdminDataLoader } from '../../composables/useAdminDataLoader.js';
import { useAdminEntityConfigs } from '../../composables/useAdminEntityConfigs.js';
import { useAdminSelectionState } from '../../composables/useAdminSelectionState.js';
import { useObjectUrlPreview } from '../../composables/useObjectUrlPreview.js';
import { asArray, getEntityNameById, hasValidEntityId, sortOrdersByDateDesc } from '../../utils.js';

const AdminTable = defineAsyncComponent(() => import('./AdminTable.vue'));
const AdminEditModal = defineAsyncComponent(() => import('./AdminEditModal.vue'));
const AdminBulkEditModal = defineAsyncComponent(() => import('./AdminBulkEditModal.vue'));
const ConfirmModal = defineAsyncComponent(() => import('./ConfirmModal.vue'));

// ── Events ──────────────────────────────────────────────────────
const emit = defineEmits(['back', 'logout']);

// ── Reactive State ──────────────────────────────────────────────
const activeTab = ref('menuk');

const menukRaw = ref([]);
const kategoriak = ref([]);
const hozzavalok = ref([]);
const keszetelek = ref([]);
const koretek = ref([]);
const uditok = ref([]);
const rendelesekRaw = ref([]);

const isLoading = ref(false);
const loadError = ref('');
const actionError = ref('');
const actionSuccess = ref('');

const showEditModal = ref(false);
const editMode = ref('edit');
const editType = ref('');
const editForm = ref({});
const saving = ref(false);

const showConfirmModal = ref(false);
const deleteTarget = ref(null);
const deleting = ref(false);

const showBulkEditModal = ref(false);
const bulkForm = ref({});
const bulkError = ref('');
const bulkSaving = ref(false);

const showBulkDeleteConfirm = ref(false);
const bulkDeleteLoading = ref(false);

// ── Helpers ─────────────────────────────────────────────────────
function clearFeedback() {
	actionError.value = '';
	actionSuccess.value = '';
}

function formatEntityItemLabel(item) {
	return (
		String(
			item?.menuNev ??
				item?.menuDisplayName ??
				item?.nev ??
				item?.hozzavaloNev ??
				item?.felhasznaloNev ??
				item?.id ??
				'?',
		) || '?'
	);
}

const {
	showBulkFailureModal,
	bulkFailureError,
	bulkFailureMessage,
	clearBulkFailurePrompt,
	confirmBulkFailureContinue,
	cancelBulkFailureContinue,
	promptBulkFailure,
} = useAdminBulkFailurePrompt({
	formatEntityItemLabel,
});

// ── Image Preview ───────────────────────────────────────────────
const currentImageUrl = computed(() => String(editForm.value?.currentImageUrl ?? '').trim());
const {
	displayedPreviewUrl,
	setPreviewFile,
	clearPreviewUrl: clearSelectedImagePreview,
} = useObjectUrlPreview(currentImageUrl);

const showImageUploadSection = computed(() => entityConfigs[editType.value]?.hasImage ?? false);

function onEditImageSelected(event) {
	const file = event?.target?.files?.[0] ?? null;
	setPreviewFile(file);
	editForm.value = { ...editForm.value, kepFile: file };
}

// ── Entity Configuration (extracted to useAdminEntityConfigs) ────
const { entityConfigs, getMenuMealId, getMenuSideId, getMenuDrinkId } = useAdminEntityConfigs({
	kategoriak,
	hozzavalok,
	keszetelek,
	koretek,
	uditok,
});

// ── Tabs & Table Items ──────────────────────────────────────────
const tabs = [
	{ key: 'rendelesek', label: 'Rendelések', entityType: 'order' },
	{ key: 'menuk', label: 'Menük', entityType: 'menu' },
	{ key: 'kategoriak', label: 'Kategóriák', entityType: 'category' },
	{ key: 'hozzavalok', label: 'Hozzávalók', entityType: 'ingredient' },
	{ key: 'keszetelek', label: 'Készételek', entityType: 'meal' },
	{ key: 'koretek', label: 'Köretek', entityType: 'side' },
	{ key: 'uditok', label: 'Üdítők', entityType: 'drink' },
];

const rendelesek = computed(() =>
	[...asArray(rendelesekRaw.value)].sort(sortOrdersByDateDesc),
);

// Menus need enrichment (display names resolved from current local FK arrays)
const menuk = computed(() =>
	asArray(menukRaw.value).map((menu) => ({
		...menu,
		menuDisplayName: String(menu?.menuNev ?? '-'),
		keszetel: getEntityNameById(keszetelek.value, getMenuMealId(menu)),
		koret: getEntityNameById(koretek.value, getMenuSideId(menu)),
		udito: getEntityNameById(uditok.value, getMenuDrinkId(menu)),
	})),
);

const tabItemsMap = computed(() => ({
	rendelesek: rendelesek.value,
	menuk: menuk.value,
	kategoriak: kategoriak.value,
	hozzavalok: hozzavalok.value,
	keszetelek: keszetelek.value,
	koretek: koretek.value,
	uditok: uditok.value,
}));

const activeTabDefinition = computed(() => tabs.find((tab) => tab.key === activeTab.value) ?? tabs[0]);
const activeEntityType = computed(() => activeTabDefinition.value?.entityType ?? '');
const activeEntityConfig = computed(() => entityConfigs[activeEntityType.value] ?? null);
const currentTabItems = computed(() => tabItemsMap.value[activeTab.value] ?? []);
const {
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
} = useAdminSelectionState({
	currentTabItems,
	activeEntityConfig,
	isLoading,
	saving,
	bulkSaving,
	bulkDeleteLoading,
	deleting,
});

const {
	loadAdminData,
	loadAdminDataForEntity,
	showingStorageSnapshot,
	storageSnapshotLoadedAt,
} = useAdminDataLoader({
	isLoading,
	loadError,
	clearFeedback,
	reconcileSelection,
	rendelesekRaw,
	menukRaw,
	kategoriak,
	hozzavalok,
	keszetelek,
	koretek,
	uditok,
});

const storageSnapshotTimeLabel = computed(() => {
	if (!storageSnapshotLoadedAt.value) return '';
	try {
		return new Intl.DateTimeFormat('hu-HU', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		}).format(new Date(storageSnapshotLoadedAt.value));
	} catch {
		return '';
	}
});

onMounted(() => {
	void loadAdminData();
});

// ── Modal ───────────────────────────────────────────────────────
const isCreateMode = computed(() => editMode.value === 'create');

const editModalTitle = computed(() => {
	const config = entityConfigs[editType.value];
	if (!config) return 'Szerkesztés';
	const modeText = isCreateMode.value ? 'létrehozása' : 'szerkesztése';
	return `${config.label} ${modeText}`;
});

const activeFormFields = computed(() => entityConfigs[editType.value]?.formFields ?? []);
const {
	createDefaultBulkForm,
	validateBulkForm,
	buildBulkUpdatePayload,
	runBulkQueue,
	createBulkFeedback,
} = useAdminBulkActionEngine({
	entityConfigs,
	bulkForm,
	promptBulkFailure,
});

bulkForm.value = createDefaultBulkForm(activeEntityType.value);

async function openModal(type, item = null) {
	clearFeedback();
	clearSelectedImagePreview();
	const config = entityConfigs[type];
	if (!config) return;

	let resolvedItem = item;
	if (item && type === 'meal' && item?.id != null) {
		try {
			const full = await getMealById(item.id);
			if (full && typeof full === 'object') {
				resolvedItem = { ...item, ...full };
			}
		} catch {
			// If details load fails, fall back to table snapshot.
			resolvedItem = item;
		}
	}

	editMode.value = item ? 'edit' : 'create';
	editType.value = type;
	editForm.value = item ? config.mapItemToForm(resolvedItem) : config.defaultForm();
	showEditModal.value = true;
}

function closeEditModal(options = {}) {
	const { clearFeedback: shouldClearFeedback = true } = options;
	clearSelectedImagePreview();
	showEditModal.value = false;
	editMode.value = 'edit';
	editType.value = '';
	editForm.value = {};
	if (shouldClearFeedback) clearFeedback();
}

function handleEditFormUpdate(nextForm) {
	editForm.value = nextForm;
}

function handleBulkFormUpdate(nextForm) {
	bulkForm.value = nextForm;
}

function closeBulkEditModal() {
	showBulkEditModal.value = false;
	bulkError.value = '';
	bulkForm.value = createDefaultBulkForm(activeEntityType.value);
}

function openBulkEditModal() {
	if (!canBulkEdit.value || selectedCount.value === 0) return;
	clearFeedback();
	bulkError.value = '';
	bulkForm.value = createDefaultBulkForm(activeEntityType.value);
	showBulkEditModal.value = true;
}

function openBulkDeleteConfirm() {
	if (!canBulkDelete.value || selectedCount.value === 0) return;
	clearFeedback();
	showBulkDeleteConfirm.value = true;
}

function closeBulkDeleteConfirm() {
	showBulkDeleteConfirm.value = false;
}

async function saveBulkEdit() {
	clearFeedback();
	bulkError.value = '';

	const config = activeEntityConfig.value;
	const entityType = activeEntityType.value;
	if (!config) {
		bulkError.value = 'Ismeretlen típus.';
		return;
	}
	if (selectedCount.value === 0) {
		bulkError.value = 'Nincs kijelölt elem.';
		return;
	}

	const validationError = validateBulkForm();
	if (validationError) {
		bulkError.value = validationError;
		return;
	}

	bulkSaving.value = true;
	const items = [...selectedItems.value];
	const actionType = String(bulkForm.value.actionType ?? '').trim();

	try {
		const result = await runBulkQueue(items, async (item) => {
			const payload = await buildBulkUpdatePayload(entityType, item, actionType);
			await config.api.update(payload);
		});
		const feedback = createBulkFeedback(config, result.successCount, result.failureCount, result.stopped);

		closeBulkEditModal();
		await loadAdminDataForEntity(entityType);
		clearSelection();
		actionSuccess.value = feedback.success;
		actionError.value = feedback.error;
	} catch (error) {
		bulkError.value = error instanceof Error ? error.message : 'Tömeges mentés sikertelen.';
	} finally {
		bulkSaving.value = false;
	}
}

// ── Save ────────────────────────────────────────────────────────
async function saveEdit() {
	clearFeedback();
	saving.value = true;

	try {
		const config = entityConfigs[editType.value];
		if (!config) throw new Error('Unknown type');

		const isCreate = isCreateMode.value;
		if (!isCreate && !editForm.value.id && editForm.value.id !== 0) {
			actionError.value = 'Hiányzó azonosító.';
			return;
		}

		const validationError = config.validate(editForm.value, isCreate);
		if (validationError) {
			actionError.value = validationError;
			return;
		}

		const payload = config.buildPayload(editForm.value, isCreate);
		const apiFn = isCreate ? config.api.create : config.api.update;
		await apiFn(payload);

		closeEditModal({ clearFeedback: false });
		actionSuccess.value = isCreate ? config.messages.create : config.messages.update;
		await loadAdminDataForEntity(editType.value);
	} catch (err) {
		actionError.value = err instanceof Error ? err.message : 'Mentés sikertelen';
	} finally {
		saving.value = false;
	}
}

// ── Delete ──────────────────────────────────────────────────────
function requestDelete(type, item) {
	clearFeedback();
	deleteTarget.value = { type, item };
	showConfirmModal.value = true;
}

const createHandlersByEntity = Object.fromEntries(
	tabs.map((tab) => [tab.entityType, () => openModal(tab.entityType)]),
);

const editHandlersByEntity = Object.fromEntries(
	tabs.map((tab) => [tab.entityType, (item) => openModal(tab.entityType, item)]),
);

const deleteHandlersByEntity = Object.fromEntries(
	tabs.map((tab) => [tab.entityType, (item) => requestDelete(tab.entityType, item)]),
);

async function confirmDelete() {
	if (!deleteTarget.value) return;
	const { type, item } = deleteTarget.value;
	const config = entityConfigs[type];
	if (!config) return;
	if (!hasValidEntityId(item?.id)) {
		actionError.value = 'Érvénytelen azonosító.';
		showConfirmModal.value = false;
		deleteTarget.value = null;
		return;
	}

	deleting.value = true;
	clearFeedback();

	try {
		await config.api.delete(item.id);
		actionSuccess.value = config.messages.delete;
		showConfirmModal.value = false;
		deleteTarget.value = null;
		await loadAdminDataForEntity(type);
	} catch (err) {
		actionError.value = err instanceof Error ? err.message : 'Törlés sikertelen';
	} finally {
		deleting.value = false;
	}
}

function cancelDelete() {
	showConfirmModal.value = false;
	deleteTarget.value = null;
	clearFeedback();
}

async function confirmBulkDelete() {
	const config = activeEntityConfig.value;
	if (!config) return;

	bulkDeleteLoading.value = true;
	clearFeedback();
	const items = [...selectedItems.value];

	try {
		const result = await runBulkQueue(items, async (item) => {
			if (!hasValidEntityId(item?.id)) throw new Error('Érvénytelen azonosító.');
			await config.api.delete(item.id);
		});
		const feedback = createBulkFeedback(config, result.successCount, result.failureCount, result.stopped);

		showBulkDeleteConfirm.value = false;
		await loadAdminDataForEntity(activeEntityType.value);
		clearSelection();
		actionSuccess.value = feedback.success;
		actionError.value = feedback.error;
	} catch (error) {
		actionError.value = error instanceof Error ? error.message : 'Tömeges törlés sikertelen.';
	} finally {
		bulkDeleteLoading.value = false;
	}
}

const confirmMessage = computed(() => {
	if (deleteTarget.value?.type === 'order') return 'Biztosan törlöd ezt a rendelést?';
	return 'Biztosan törlöd ezt az elemet?';
});

const bulkDeleteMessage = computed(() => {
	if (!activeEntityConfig.value) return 'Biztosan törlöd a kijelölt elemeket?';
	return `Biztosan törlöd a kijelölt ${selectedCount.value} ${activeEntityConfig.value.label.toLowerCase()} elemet?`;
});

watch(activeTab, () => {
	clearSelection();
	closeBulkEditModal();
	clearBulkFailurePrompt();
	clearFeedback();
	reconcileSelection();
});
</script>

<template>
	<div class="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 p-5">
		<!-- Header -->
		<div class="bg-white p-8 rounded-xl shadow-md mb-5">
			<div class="flex justify-between items-center gap-5 max-md:flex-col max-md:items-start">
				<div>
					<h1 class="text-4xl font-bold text-gray-800 mb-2">Itterem Admin Panel</h1>
					<div class="text-gray-500">Étterem Kezelő Rendszer</div>
				</div>
				<div class="flex gap-3 max-md:w-full">
					<!-- <button
						class="px-5 py-2.5 rounded-lg font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition cursor-pointer max-md:flex-1"
						@click="emit('back')"
					>
						← Vissza
					</button> -->
					<button
						class="px-5 py-2.5 rounded-lg font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition cursor-pointer max-md:flex-1"
						@click="loadAdminData"
					>
						↻ Frissítés
					</button>
<!-- 					<button
						class="px-5 py-2.5 rounded-lg font-semibold bg-red-100 text-red-800 hover:bg-red-200 transition cursor-pointer max-md:flex-1"
						@click="emit('logout')"
					>
						Kijelentkezés
					</button> -->
				</div>
			</div>
		</div>

		<!-- Navigation Tabs -->
		<div class="flex gap-2 bg-white p-4 rounded-xl shadow-md mb-5 overflow-x-auto flex-wrap">
			<button
				v-for="tab in tabs"
				:key="tab.key"
				:class="[
					'px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition cursor-pointer',
					activeTab === tab.key
						? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
						: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
				]"
				@click="activeTab = tab.key"
			>
				{{ tab.label }}
			</button>
		</div>

		<!-- Content Area -->
		<div class="bg-white rounded-xl shadow-md p-8 min-h-[500px]">
			<div class="mb-4 min-h-[116px]">
				<div
					:class="[
						'rounded-2xl border p-4 transition-opacity duration-150',
						selectedCount > 0
							? 'border-indigo-200 bg-gradient-to-r from-indigo-50 to-sky-50 opacity-100'
							: 'pointer-events-none border-transparent bg-transparent opacity-0',
					]"
				>
					<div v-if="selectedCount > 0" class="flex flex-wrap items-center justify-between gap-4">
						<div>
							<div class="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Kijelölt elemek</div>
							<div class="mt-1 text-lg font-semibold text-gray-800">{{ selectedCount }} elem kiválasztva ezen a lapon</div>
							<div v-if="bulkActionHint" class="mt-1 text-sm text-gray-600">{{ bulkActionHint }}</div>
						</div>
						<div class="flex flex-wrap gap-2">
							<button
								v-if="canBulkEdit"
								class="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
								:disabled="selectionBusy"
								@click="openBulkEditModal"
							>
								Tömeges szerkesztés
							</button>
							<button
								v-if="canBulkDelete"
								class="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
								:disabled="selectionBusy"
								@click="openBulkDeleteConfirm"
							>
								Kijelöltek törlése
							</button>
							<button
								class="cursor-pointer rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 transition hover:bg-gray-50 disabled:opacity-50"
								:disabled="selectionBusy"
								@click="clearSelection"
							>
								Kijelölés törlése
							</button>
						</div>
					</div>
				</div>
			</div>

			<div v-if="isLoading" class="mb-4 rounded-lg bg-white/90 p-3 text-sm font-medium text-gray-800">
				Adatok betöltése...
			</div>
			<div v-else-if="loadError" class="mb-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
				{{ loadError }}
			</div>

			<div
				v-if="showingStorageSnapshot"
				class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800"
			>
				<div>
					Gyorsítótárból betöltött adatok láthatók
					<span v-if="storageSnapshotTimeLabel">({{ storageSnapshotTimeLabel }})</span>.
				</div>
				<div class="mt-1 text-xs text-amber-700">
					{{ isLoading ? 'Frissítés folyamatban a szerverről…' : 'A szerverfrissítés részben vagy teljesen sikertelen volt, ezért a gyorsítótár maradt látható.' }}
				</div>
			</div>

			<div v-if="actionError" class="mb-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
				{{ actionError }}
			</div>
			<div v-if="actionSuccess" class="mb-4 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-800">
				{{ actionSuccess }}
			</div>

			<template v-for="tab in tabs" :key="tab.key">
				<AdminTable
					v-if="activeTab === tab.key"
					:columns="entityConfigs[tab.entityType].columns"
					:items="tabItemsMap[tab.key] ?? []"
					:title="entityConfigs[tab.entityType].tableTitle"
					:add-label="entityConfigs[tab.entityType].addLabel"
					:show-create="entityConfigs[tab.entityType].showCreate ?? true"
					:show-edit="entityConfigs[tab.entityType].showEdit ?? true"
					:show-delete="entityConfigs[tab.entityType].showDelete ?? true"
					selection-enabled
					:selected-ids="selectedIds"
					:all-selected="allSelected"
					:some-selected="someSelected"
					:selection-disabled="selectionBusy"
					@create="createHandlersByEntity[tab.entityType]"
					@edit="editHandlersByEntity[tab.entityType]"
					@delete="deleteHandlersByEntity[tab.entityType]"
					@toggle-select-all="toggleSelectAll"
					@toggle-select-item="toggleSelectItem"
				/>
			</template>
		</div>

		<!-- Edit / Create Modal -->
		<AdminEditModal
			:show="showEditModal"
			:title="editModalTitle"
			:error="actionError"
			:is-create-mode="isCreateMode"
			:fields="activeFormFields"
			:form="editForm"
			:show-image-upload="showImageUploadSection"
			:image-preview="displayedPreviewUrl"
			:saving="saving"
			@close="closeEditModal"
			@save="saveEdit"
			@image-selected="onEditImageSelected"
			@update:form="handleEditFormUpdate"
		/>

		<AdminBulkEditModal
			:show="showBulkEditModal"
			:entity-label="activeEntityConfig?.label ?? 'Elem'"
			:selected-count="selectedCount"
			:capabilities="activeBulkCapabilities"
			:form="bulkForm"
			:error="bulkError"
			:saving="bulkSaving"
			@close="closeBulkEditModal"
			@save="saveBulkEdit"
			@update:form="handleBulkFormUpdate"
		/>

		<!-- Confirm Delete Modal -->
		<ConfirmModal
			:show="showConfirmModal"
			:loading="deleting"
			title="Törlés megerősítése"
			:message="confirmMessage"
			:error="actionError"
			@confirm="confirmDelete"
			@cancel="cancelDelete"
		/>

		<ConfirmModal
			:show="showBulkDeleteConfirm"
			:loading="bulkDeleteLoading"
			title="Tömeges törlés megerősítése"
			:message="bulkDeleteMessage"
			:error="actionError"
			confirm-label="Kijelöltek törlése"
			@confirm="confirmBulkDelete"
			@cancel="closeBulkDeleteConfirm"
		/>

		<ConfirmModal
			:show="showBulkFailureModal"
			title="Tömeges művelet megszakadt"
			:message="bulkFailureMessage"
			:error="bulkFailureError"
			confirm-label="Folytatás"
			cancel-label="Leállítás"
			confirm-variant="primary"
			@confirm="confirmBulkFailureContinue"
			@cancel="cancelBulkFailureContinue"
		/>
	</div>
</template>
