<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import draggable from 'vuedraggable';
import { getMeals, getMenus, getOrders, updateOrderStatus } from '../../api.js';
import { useEmployeeOrderDisplay } from '../../composables/useEmployeeOrderDisplay.js';
import { useSignalR } from '../../composables/useSignalR.js';
import { useEmployeeOrdersBoot } from '../../composables/useEmployeeOrdersBoot.js';
import { useEmployeeOrderBoardColumns } from '../../composables/useEmployeeOrderBoardColumns.js';
import { useEmployeeOrderRealtimeEvents } from '../../composables/useEmployeeOrderRealtimeEvents.js';
import { useFloatingPanel } from '../../composables/useFloatingPanel.js';
import { useOrderIngredientsLookup } from '../../composables/useOrderIngredientsLookup.js';
import { toOrderId, useOrderColumns } from '../../composables/useOrderColumns.js';
import { useOrderStatusDnD } from '../../composables/useOrderStatusDnD.js';
import {
	normalizeOrderDto,
	readText,
} from '../../order-dto.js';
import {
	asArray,
	findById,
	formatDateTime,
	getOrderItemName,
	getOrderStatusClasses,
} from '../../utils.js';
import {
	AUTH_EXPIRED_EVENT,
	POLL_INTERVAL_MS,
	ENABLE_EMPLOYEE_ORDER_POLLING,
	PANEL_PREFS_KEY,
	PANEL_MIN_WIDTH,
	PANEL_MIN_HEIGHT,
	PANEL_DEFAULT_WIDTH,
	PANEL_DEFAULT_HEIGHT,
	PANEL_FONT_MIN,
	PANEL_FONT_MAX,
} from '../../constants.js';

const emit = defineEmits(['logout']);

const loading = ref(false);
const error = ref('');

const meals = ref([]);
const menus = ref([]);

const selectedOrderId = ref(null);
const selectedOrderSnapshot = ref(null);

const {
	panelX,
	panelY,
	panelW,
	panelH,
	panelRef,
	detailFontSize,
	onPanelPointerDown,
	onPanelPointerMove,
	onPanelPointerUp,
	decFont,
	incFont,
	initializePanel,
	cleanupPanel,
	handlePanelRefChange,
} = useFloatingPanel({
	prefsKey: PANEL_PREFS_KEY,
	minWidth: PANEL_MIN_WIDTH,
	minHeight: PANEL_MIN_HEIGHT,
	defaultWidth: PANEL_DEFAULT_WIDTH,
	defaultHeight: PANEL_DEFAULT_HEIGHT,
	fontMin: PANEL_FONT_MIN,
	fontMax: PANEL_FONT_MAX,
});

const {
	pendingOrders,
	processingOrders,
	readyOrders,
	allOrders,
	normalizeOrders,
	findOrderLocation,
	upsertOrderIntoColumns,
	getListRef,
	ensureOrderInColumn,
} = useOrderColumns({
	selectedOrderId,
	selectedOrderSnapshot,
	normalizeOrderDto,
	readText,
});

const { connectionState, SIGNALR_CONNECTION_STATE } = useSignalR();

// DEV helper: make it obvious that data arrived via SignalR.
const showRealtimeDebug = import.meta.env.DEV;

const queuedOrdersReload = ref(false);
const { columnOpen, columns, toggleColumn } = useEmployeeOrderBoardColumns();

const { getOrderEntryIngredients } = useOrderIngredientsLookup({
	meals,
	menus,
	findById,
});

async function loadOrders() {
	if (loading.value) {
		queuedOrdersReload.value = true;
		return;
	}

	loading.value = true;
	try {
		const list = await getOrders();
		const normalizedList = asArray(list)
			.map((order) => normalizeOrderDto(order))
			.filter(Boolean);
		normalizeOrders(normalizedList);
		if (selectedOrderId.value != null) {
			const selectedId = toOrderId(selectedOrderId.value);
			const found = normalizedList.find((order) => toOrderId(order?.id) === selectedId) ?? null;
			if (found) selectedOrderSnapshot.value = found;
		}
	} catch (err) {
		normalizeOrders([]);
		error.value = err?.message || 'Rendelések betöltése sikertelen.';
	} finally {
		loading.value = false;
		if (queuedOrdersReload.value) {
			queuedOrdersReload.value = false;
			void loadOrders();
		}
	}
}

async function loadCatalog() {
	try {
		const [mealsRes, menusRes] = await Promise.allSettled([getMeals(), getMenus()]);
		meals.value = mealsRes.status === 'fulfilled' ? asArray(mealsRes.value) : [];
		menus.value = menusRes.status === 'fulfilled' ? asArray(menusRes.value) : [];
	} catch {
		meals.value = [];
		menus.value = [];
	}
}

const selectedOrder = computed(() =>
	allOrders.value.find((order) => toOrderId(order?.id) === toOrderId(selectedOrderId.value)) ?? null,
);

const visibleOrder = computed(() => selectedOrder.value ?? selectedOrderSnapshot.value);

const visibleOrderEntries = computed(() => {
	const entries = asArray(visibleOrder.value?.rendelesElemeks);
	return entries.map((entry) => ({
		entry,
		itemName: getOrderItemName(entry),
		ingredients: getOrderEntryIngredients(entry),
	}));
});

const ingredientFontSize = computed(() => Math.min(32, Math.max(12, detailFontSize.value + 2)));

function closePanel() {
	selectedOrderId.value = null;
	selectedOrderSnapshot.value = null;
}

const { savingStatus, onDraggableChange, isDragCooldown } = useOrderStatusDnD({
	persistStatus: updateOrderStatus,
	reloadOrders: loadOrders,
	ensureOrderInColumn,
	onError: (msg) => { error.value = msg; },
});

const {
	pendingRefresh,
	isDraggingOrder,
	clearPendingRefreshTimer,
	schedulePendingRefreshFlush,
	onOrderDragStart,
	onOrderDragEnd,
	handleOrderPlaced,
	handleOrderUpdated,
} = useEmployeeOrderRealtimeEvents({
	loadOrders,
	normalizeOrderDto,
	upsertOrderIntoColumns,
	findOrderLocation,
	readText,
	toOrderId,
	savingStatus,
	isDragCooldown,
});

const {
	formatElapsed,
	isOrderSelected,
	getOrderCardItemCount,
	getOrderElapsedLabel,
	getColumnCount,
	realtimeIndicatorClass,
} = useEmployeeOrderDisplay({
	connectionState,
	SIGNALR_CONNECTION_STATE,
	selectedOrderId,
	toOrderId,
	getListRef,
});

watch(pendingRefresh, () => {
	if (pendingRefresh.value) schedulePendingRefreshFlush();
});

watch(savingStatus, () => {
	if (pendingRefresh.value && !savingStatus.value) {
		schedulePendingRefreshFlush();
	}
});

useEmployeeOrdersBoot({
	initializePanel,
	cleanupPanel,
	loadOrders,
	loadCatalog,
	onOrderPlaced: handleOrderPlaced,
	onOrderUpdated: handleOrderUpdated,
	savingStatus,
	isDragCooldown,
	isDraggingRef: isDraggingOrder,
	connectionState,
	enableOrderPolling: ENABLE_EMPLOYEE_ORDER_POLLING,
	pollIntervalMs: POLL_INTERVAL_MS,
	authExpiredEvent: AUTH_EXPIRED_EVENT,
});

watch(
	() => selectedOrder.value,
	(next) => {
		if (next) selectedOrderSnapshot.value = next;
	},
);

watch(
	() => panelRef.value,
	(el, prev) => {
		handlePanelRefChange(el, prev);
	},
);

onBeforeUnmount(() => {
	clearPendingRefreshTimer();
});
</script>

<template>
	<div class="relative h-[calc(100vh-0px)] overflow-hidden bg-gray-50">
		<!-- DEV: SignalR indicator (make it very obvious updates are live) -->
		<teleport to="body">
			<div
				v-if="showRealtimeDebug"
				class="fixed left-0 top-0 z-[60]"
				role="status"
				aria-live="polite"
				title="AZONNALI FRISSÍTÉS"
				aria-label="AZONNALI FRISSÍTÉS"
			>
				<span
					class="inline-flex h-3.5 w-3.5 rounded-full ring-1 ring-gray-300"
					:class="realtimeIndicatorClass"
				/>
			</div>
		</teleport>

		<!-- Minimal logout button (icon-only, bottom corner) -->
		<button
			type="button"
			class="fixed bottom-4 right-4 z-[60] inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-700 ring-1 ring-gray-300 shadow-sm hover:bg-gray-50"
			aria-label="Kijelentkezés"
			title="Kijelentkezés"
			@click="emit('logout')"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					fill-rule="evenodd"
					d="M10 2a1 1 0 011 1v6a1 1 0 11-2 0V3a1 1 0 011-1zM6.364 4.636a1 1 0 010 1.414A5 5 0 1013.636 6.05a1 1 0 011.414-1.414 7 7 0 11-9.9 0 1 1 0 011.214-.186z"
					clip-rule="evenodd"
				/>
			</svg>
		</button>

		<div v-if="error" class="mx-auto max-w-4xl px-4 pt-4">
			<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
				{{ error }}
			</div>
		</div>

		<div class="flex h-full gap-4 p-4">
			<div
				v-for="col in columns"
				:key="col.key"
				:class="[
					'flex flex-col rounded-xl border border-gray-200 shadow-sm transition-all duration-300',
					col.headerClass,
					columnOpen[col.key] ? 'flex-1 min-w-[16rem]' : 'w-16 flex-none',
				]"
			>
				<!-- Column header -->
				<div
					class="flex items-center justify-between border-b border-gray-200 px-3 py-3"
				>
					<div v-if="columnOpen[col.key]" class="flex items-center gap-2">
						<div class="text-sm font-semibold text-gray-900">{{ col.label }}</div>
						<div class="rounded-full bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white">
							{{ getColumnCount(col.key) }}
						</div>
					</div>

					<div v-else class="flex w-full items-center justify-center">
						<div class="-rotate-90 whitespace-nowrap text-xs font-semibold text-gray-800">
							{{ col.label }} ({{ getColumnCount(col.key) }})
						</div>
					</div>

					<button
						type="button"
						class="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-700 hover:bg-white/60"
						:title="columnOpen[col.key] ? 'Összecsukás' : 'Kinyitás'"
						@click="toggleColumn(col.key)"
					>
						<svg
							v-if="columnOpen[col.key]"
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							viewBox="0 0 20 20"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M12.5 4.5L7.5 10l5 5.5" />
						</svg>
						<svg
							v-else
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							viewBox="0 0 20 20"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M7.5 4.5L12.5 10l-5 5.5" />
						</svg>
					</button>
				</div>

				<!-- Column body -->
				<div v-show="columnOpen[col.key]" class="flex-1 overflow-y-auto p-3">
					<p v-if="loading && getListRef(col.key).value.length === 0" class="text-sm text-gray-500">Betöltés…</p>

					<draggable
						:list="getListRef(col.key).value"
						group="orders"
						item-key="id"
						:disabled="savingStatus"
						ghost-class="opacity-50"
						:animation="150"
						class="min-h-full min-h-[4.5rem] pb-2"
						@start="onOrderDragStart"
						@end="onOrderDragEnd"
						@change="onDraggableChange($event, col.status)"
					>
						<template #item="{ element }">
							<button
								type="button"
								class="mb-3 w-full cursor-grab rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm active:cursor-grabbing"
								:class="
									isOrderSelected(element?.id)
										? 'ring-2 ring-indigo-500'
										: 'hover:bg-gray-50'
								"
								@click="selectedOrderId = element?.id"
							>
								<div class="flex items-start justify-between gap-2">
									<div class="text-base font-bold text-gray-900">#{{ element?.id }}</div>
									<div class="flex items-center gap-2">
										<span

											:class="[
												'inline-block shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
												getOrderStatusClasses(element?.statusz),
											]"
										>
											{{ element?.statusz || '-' }}
										</span>
									</div>
								</div>
								<div class="mt-2 flex items-center justify-between gap-3 text-sm text-gray-700">
									<div>Eltelt idő: <span class="font-semibold">{{ getOrderElapsedLabel(element) }}</span></div>
									<div class="text-xs text-gray-500">{{ formatDateTime(element?.datum) }}</div>
								</div>
								<div class="mt-2 text-sm text-gray-700">
									Tételek: <span class="font-semibold">{{ getOrderCardItemCount(element) }}</span>
								</div>
							</button>
						</template>
						<template #footer>
							<div
								v-if="getListRef(col.key).value.length === 0"
								class="rounded-md border border-dashed border-gray-200 bg-white/60 p-4 text-sm text-gray-600"
							>
								Nincs rendelés.
							</div>
							<div v-else class="h-10" aria-hidden="true" />
						</template>
					</draggable>
				</div>
			</div>
		</div>

		<!-- Floating details panel -->
		<div
			v-if="visibleOrder"
			ref="panelRef"
			class="fixed z-50 flex flex-col overflow-hidden resize rounded-xl border border-gray-200 bg-white shadow-2xl"
			:style="{ left: panelX + 'px', top: panelY + 'px', width: panelW + 'px', height: panelH + 'px' }"
			style="min-width: 320px; min-height: 220px;"
		>
			<div
				class="flex cursor-move select-none items-center justify-between gap-3 border-b border-gray-200 bg-gray-900 px-3 py-2 text-white"
				@pointerdown="onPanelPointerDown"
				@pointermove="onPanelPointerMove"
				@pointerup="onPanelPointerUp"
				@pointercancel="onPanelPointerUp"
			>
				<div class="flex items-center gap-3">
					<div class="text-sm font-semibold">#{{ visibleOrder?.id }}</div>
					<div class="text-xs text-white/80">{{ formatDateTime(visibleOrder?.datum) }}</div>
				</div>
				<div class="flex items-center gap-2" data-no-drag="true">
					<button
						type="button"
						class="rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-white/30 hover:bg-white/10"
						@click.stop="decFont"
						@pointerdown.stop
						:title="'Betűméret csökkentése'"
					>
						A-
					</button>
					<button
						type="button"
						class="rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-white/30 hover:bg-white/10"
						@click.stop="incFont"
						@pointerdown.stop
						:title="'Betűméret növelése'"
					>
						A+
					</button>
					<button
						type="button"
						class="rounded-md px-2 py-1 text-xs font-semibold text-red-200 ring-1 ring-white/30 hover:bg-white/10 hover:text-red-100"
						@click.stop="closePanel"
						@pointerdown.stop
						title="Bezárás"
					>
						X
					</button>
				</div>
			</div>

			<div class="flex-1 overflow-auto p-4" :style="{ fontSize: detailFontSize + 'px' }">
				<div class="flex items-center justify-between gap-3">
					<div class="text-base font-bold text-gray-900">Tételek</div>
					<span
						:class="[
							'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold',
							getOrderStatusClasses(visibleOrder?.statusz),
						]"
					>
						{{ visibleOrder?.statusz || '-' }}
					</span>
				</div>

				<div class="mt-3">
					<p v-if="visibleOrderEntries.length === 0" class="text-sm text-gray-600">
						Nincs tétel.
					</p>
					<ul v-else class="space-y-2">
						<li
							v-for="entryView in visibleOrderEntries"
							:key="entryView.entry.id"
							class="flex items-start justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
						>
							<div class="min-w-0">
								<div class="font-semibold text-gray-900">{{ entryView.itemName }}</div>
								<div v-if="entryView.ingredients.length" class="mt-1 text-gray-700" :style="{ fontSize: ingredientFontSize + 'px' }">
									<ul class="space-y-0.5">
										<li v-for="name in entryView.ingredients" :key="`${entryView.entry.id ?? 'entry'}-${name}`">{{ name }}</li>
									</ul>
								</div>
							</div>
							<div class="shrink-0 text-gray-800">× {{ entryView.entry?.mennyiseg ?? 0 }}</div>
						</li>
					</ul>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.status-atvehetö {
	animation: none !important;
	box-shadow: none !important;
	border-width: 0 !important;
}
</style>
