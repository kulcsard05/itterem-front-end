<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { useI18n } from 'vue-i18n';
import draggable from 'vuedraggable';
import { getMeals, getMenus, getOrders, updateOrderStatus } from '../../services/api.js';
import FloatingOrderDetailsPanel from './FloatingOrderDetailsPanel.vue';
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
} from '../../domain/order/order-dto.js';
import {
	asArray,
	findById,
	formatDateTime,
	getOrderItemName,
} from '../../shared/utils.js';
import { readStorageJson, writeStorageJson } from '../../storage/storage-utils.js';
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
	ORDER_STATUSES,
} from '../../config/constants.js';

const emit = defineEmits(['logout']);
const { t } = useI18n();

const loading = ref(false);
const error = ref('');
const showOrderCardConfig = ref(false);
const orderCardDisplayMode = ref('count');
const timerWarningMinutes = ref(5);
const timerDangerMinutes = ref(10);
const lastTappedOrderId = ref('');
const lastTappedAt = ref(0);
const advancingOrder = ref(false);

const DOUBLE_ACTIVATE_WINDOW_MS = 350;
const FINAL_ORDER_STATUS = ORDER_STATUSES[ORDER_STATUSES.length - 1] ?? '';
const BOARD_PREFS_KEY = `${PANEL_PREFS_KEY}:boardPrefs`;

let saveBoardPrefsTimer = null;

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
	onPanelLostPointerCapture,
	onPanelResizePointerDown,
	onPanelResizePointerMove,
	onPanelResizePointerUp,
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

function readBoardPrefs() {
	const parsed = readStorageJson(BOARD_PREFS_KEY, {
		storage: localStorage,
		fallback: null,
	});
	return parsed && typeof parsed === 'object' ? parsed : null;
}

function writeBoardPrefs() {
	const payload = {
		columnOpen: {
			pending: !!columnOpen.pending,
			processing: !!columnOpen.processing,
			ready: !!columnOpen.ready,
		},
		orderCardDisplayMode: orderCardDisplayMode.value,
		timerWarningMinutes: timerWarningMinutes.value,
		timerDangerMinutes: timerDangerMinutes.value,
	};
	writeStorageJson(BOARD_PREFS_KEY, payload, {
		storage: localStorage,
		warnOnError: false,
	});
}

function saveBoardPrefs() {
	if (saveBoardPrefsTimer != null) clearTimeout(saveBoardPrefsTimer);
	saveBoardPrefsTimer = setTimeout(() => {
		saveBoardPrefsTimer = null;
		writeBoardPrefs();
	}, 200);
}

function initializeBoardPrefs() {
	const prefs = readBoardPrefs();
	if (!prefs) return;

	const persistedColumnOpen = prefs.columnOpen;
	if (persistedColumnOpen && typeof persistedColumnOpen === 'object') {
		if (typeof persistedColumnOpen.pending === 'boolean') columnOpen.pending = persistedColumnOpen.pending;
		if (typeof persistedColumnOpen.processing === 'boolean') columnOpen.processing = persistedColumnOpen.processing;
		if (typeof persistedColumnOpen.ready === 'boolean') columnOpen.ready = persistedColumnOpen.ready;
	}

	if (prefs.orderCardDisplayMode === 'count' || prefs.orderCardDisplayMode === 'items') {
		orderCardDisplayMode.value = prefs.orderCardDisplayMode;
	}

	const warning = Number(prefs.timerWarningMinutes);
	if (Number.isFinite(warning) && warning >= 0) {
		timerWarningMinutes.value = Math.floor(warning);
	}

	const danger = Number(prefs.timerDangerMinutes);
	if (Number.isFinite(danger) && danger >= timerWarningMinutes.value) {
		timerDangerMinutes.value = Math.floor(danger);
	}
}

initializeBoardPrefs();

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
const showOrderCardItems = computed({
	get: () => orderCardDisplayMode.value === 'items',
	set: (value) => {
		orderCardDisplayMode.value = value ? 'items' : 'count';
	},
});

function formatOrderTimeShort(value) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return '--:--';
	return new Intl.DateTimeFormat('hu-HU', {
		hour: '2-digit',
		minute: '2-digit',
	}).format(date);
}

function getOrderCardItemNames(order) {
	return asArray(order?.rendelesElemeks).flatMap((entry) => {
		const quantity = Number(entry?.mennyiseg);
		const quantityLabel = Number.isFinite(quantity) && quantity > 1 ? ` x${quantity}` : '';
		const names = [
			String(entry?.keszetelNev ?? '').trim(),
			String(entry?.uditoNev ?? '').trim(),
			String(entry?.menuNev ?? '').trim(),
			String(entry?.koretNev ?? '').trim(),
		].filter(Boolean);

		if (names.length === 0) {
			const fallbackName = String(getOrderItemName(entry) ?? '').trim();
			return fallbackName ? [`${fallbackName}${quantityLabel}`] : [];
		}

		return names.map((name) => `${name}${quantityLabel}`);
	});
}

function getOrderCustomerName(order) {
	const name = String(order?.teljesNev ?? order?.felhasznaloNev ?? '').trim();
	return name || '-';
}

function getOrderCustomerPhone(order) {
	const phone = String(order?.telefonszam ?? order?.telefonSzam ?? '').trim();
	return phone || '-';
}

function getTimerWarningMinutes() {
	const warning = Number(timerWarningMinutes.value);
	if (!Number.isFinite(warning) || warning < 0) return 0;
	return Math.floor(warning);
}

function getTimerDangerMinutes() {
	const warning = getTimerWarningMinutes();
	const danger = Number(timerDangerMinutes.value);
	if (!Number.isFinite(danger) || danger < warning) return warning;
	return Math.floor(danger);
}

function getOrderTimerBarClass(order) {
	const elapsedMinutes = getOrderElapsedMinutes(order);
	const warning = getTimerWarningMinutes();
	const danger = getTimerDangerMinutes();

	if (elapsedMinutes >= danger) return 'bg-red-100 text-red-900';
	if (elapsedMinutes >= warning) return 'bg-amber-100 text-amber-900';
	return 'bg-sky-100 text-sky-900';
}

function closePanel() {
	selectedOrderId.value = null;
	selectedOrderSnapshot.value = null;
}

async function advanceOrderToNextStatus(order) {
	if (advancingOrder.value || savingStatus.value) return;

	const orderId = toOrderId(order?.id);
	if (!orderId) return;

	const currentStatus = String(order?.statusz ?? '').trim();
	const currentIndex = ORDER_STATUSES.indexOf(currentStatus);
	if (currentIndex < 0) return;

	const nextStatus = ORDER_STATUSES[currentIndex + 1] ?? '';
	if (!nextStatus) return;

	advancingOrder.value = true;
	try {
		await updateOrderStatus(orderId, nextStatus);
		if (nextStatus === FINAL_ORDER_STATUS && selectedOrderId.value === orderId) {
			closePanel();
		}
		await loadOrders();
	} catch (err) {
		error.value = err?.message || 'Státusz mentése sikertelen.';
	} finally {
		advancingOrder.value = false;
	}
}

function onOrderCardActivate(order) {
	const orderId = toOrderId(order?.id);
	if (!orderId) return;

	selectedOrderId.value = order?.id;

	const now = Date.now();
	const isDoubleActivate = lastTappedOrderId.value === orderId
		&& now - lastTappedAt.value <= DOUBLE_ACTIVATE_WINDOW_MS;

	lastTappedOrderId.value = orderId;
	lastTappedAt.value = now;

	if (!isDoubleActivate) return;

	lastTappedOrderId.value = '';
	lastTappedAt.value = 0;
	void advanceOrderToNextStatus(order);
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
	getOrderElapsedMinutes,
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

watch(
	() => ({
		pending: columnOpen.pending,
		processing: columnOpen.processing,
		ready: columnOpen.ready,
	}),
	() => {
		saveBoardPrefs();
	},
	{ deep: true },
);

watch(
	[orderCardDisplayMode, timerWarningMinutes, timerDangerMinutes],
	() => {
		saveBoardPrefs();
	},
);

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
	() => panelRef.value?.panelElement?.value ?? panelRef.value?.panelElement ?? null,
	(el, prev) => {
		handlePanelRefChange(el, prev);
	},
);

function onWindowBeforeUnload(event) {
	const leaveConfirmMessage = t('nav.leaveEmployeePageConfirmMessage');
	event.preventDefault();
	event.returnValue = leaveConfirmMessage;
	return leaveConfirmMessage;
}

onMounted(() => {
	window.addEventListener('beforeunload', onWindowBeforeUnload);
});

onBeforeRouteLeave((to, from, next) => {
	if (to?.name === from?.name) {
		next();
		return;
	}

	const confirmed = window.confirm(t('nav.leaveEmployeePageConfirmMessage'));
	next(confirmed);
});

onBeforeUnmount(() => {
	clearPendingRefreshTimer();
	window.removeEventListener('beforeunload', onWindowBeforeUnload);
	if (saveBoardPrefsTimer != null) {
		clearTimeout(saveBoardPrefsTimer);
		saveBoardPrefsTimer = null;
	}
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

		<button
			type="button"
			class="fixed bottom-4 left-4 z-[60] inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/80 text-white ring-1 ring-white/30 shadow-sm backdrop-blur-sm hover:bg-black"
			@click="showOrderCardConfig = !showOrderCardConfig"
			aria-label="Rendeléskártya beállítások"
			title="Rendeléskártya beállítások"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path fill-rule="evenodd" d="M11.49 3.17a1 1 0 00-1.98 0l-.11 1.25a6.98 6.98 0 00-1.68.97L6.58 4.6a1 1 0 10-1.41 1.4l.8 1.13a7.01 7.01 0 00-.7 1.77l-1.24.1a1 1 0 000 1.99l1.25.1c.14.63.37 1.22.69 1.77l-.8 1.14a1 1 0 101.4 1.4l1.14-.8c.52.39 1.08.71 1.68.96l.1 1.25a1 1 0 001.99 0l.1-1.25c.6-.25 1.16-.57 1.68-.96l1.14.8a1 1 0 001.4-1.4l-.8-1.14c.32-.55.55-1.14.69-1.77l1.25-.1a1 1 0 000-1.99l-1.25-.1a7 7 0 00-.7-1.77l.8-1.13a1 1 0 00-1.4-1.4l-1.14.8a6.98 6.98 0 00-1.68-.97l-.1-1.25zM10.5 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clip-rule="evenodd" />
			</svg>
		</button>

		<div
			class="fixed bottom-20 left-4 z-[60] w-72 rounded-xl border border-white/20 bg-black/75 p-4 text-white shadow-xl backdrop-blur-sm transition-all duration-300"
			:class="showOrderCardConfig ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'"
		>
			<div class="mb-3 text-sm font-bold text-white">Rendeléskártya beállítás</div>
			<div class="space-y-2 text-sm text-gray-100">
				<label class="flex items-center gap-3">
					<input v-model="showOrderCardItems" type="checkbox" class="h-4 w-4 rounded border-white/40 bg-black/20 text-sky-400 focus:ring-sky-400">
					<span>Tételek kilistázása</span>
				</label>
				<div class="mt-3 space-y-2 rounded-lg border border-white/15 bg-white/5 p-3">
					<div class="text-xs font-semibold uppercase tracking-wide text-gray-300">Idősáv küszöbök (perc)</div>
					<label class="flex items-center justify-between gap-3">
						<span class="text-xs text-gray-200">Sárga kezdete</span>
						<input
							v-model.number="timerWarningMinutes"
							type="number"
							min="0"
							class="w-20 rounded-md border border-white/20 bg-black/30 px-2 py-1 text-right text-sm text-white outline-none ring-0"
						>
					</label>
					<label class="flex items-center justify-between gap-3">
						<span class="text-xs text-gray-200">Piros kezdete</span>
						<input
							v-model.number="timerDangerMinutes"
							type="number"
							:min="getTimerWarningMinutes()"
							class="w-20 rounded-md border border-white/20 bg-black/30 px-2 py-1 text-right text-sm text-white outline-none ring-0"
						>
					</label>
				</div>
			</div>
		</div>

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
					columnOpen[col.key] ? 'flex-1 min-w-[16rem]' : 'w-28 flex-none',
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
								class="mb-3 w-full cursor-grab overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-sm active:cursor-grabbing"
								:class="
									isOrderSelected(element?.id)
										? 'ring-2 ring-indigo-500'
										: 'hover:bg-gray-50'
								"
								@click="onOrderCardActivate(element)"
							>
									<div
										class="flex items-center justify-between gap-3 px-4 py-2 text-sm font-semibold"
										:class="getOrderTimerBarClass(element)"
									>
										<div>{{ getOrderElapsedLabel(element) }}</div>
										<div>{{ formatOrderTimeShort(element?.datum) }}</div>
									</div>
									<div class="p-4">
										<div class="text-center text-2xl font-extrabold text-gray-900">{{ element?.id }}</div>
										<div class="mt-1 flex justify-end">
											<div class="max-w-[55%] truncate text-right text-xs font-semibold text-gray-600">{{ getOrderCustomerPhone(element) }}</div>
										</div>
										<div v-if="orderCardDisplayMode === 'items'" class="mt-2">
											<ul class="space-y-1 text-sm text-gray-700">
												<li
													v-for="(itemName, itemIndex) in getOrderCardItemNames(element)"
													:key="`${element?.id}-${itemIndex}-${itemName}`"
													class="flex items-center justify-between gap-3"
												>
													<span class="truncate">{{ itemName }}</span>
													<span
														v-if="itemIndex === getOrderCardItemNames(element).length - 1"
														class="ml-2 max-w-[55%] truncate text-right text-xs font-semibold text-gray-600"
													>
														{{ getOrderCustomerName(element) }}
													</span>
												</li>
												<li v-if="getOrderCardItemNames(element).length === 0" class="flex items-center justify-between gap-3 text-gray-500">
													<span>Nincs tétel.</span>
													<span class="ml-2 max-w-[55%] truncate text-right text-xs font-semibold text-gray-600">{{ getOrderCustomerName(element) }}</span>
												</li>
											</ul>
										</div>
										<div v-else class="mt-2 flex items-center justify-between gap-3 text-sm text-gray-700">
											<div>Tételek: <span class="font-semibold">{{ getOrderCardItemCount(element) }}</span></div>
											<div class="max-w-[55%] truncate text-right text-xs font-semibold text-gray-600">{{ getOrderCustomerName(element) }}</div>
										</div>
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

				<div v-show="!columnOpen[col.key]" class="flex-1 overflow-y-auto px-2 py-3">
					<div v-if="getListRef(col.key).value.length === 0" class="py-2 text-center text-xs text-gray-500">-</div>
					<div v-else class="space-y-2">
						<button
							v-for="element in getListRef(col.key).value"
							:key="`collapsed-${col.key}-${element?.id}`"
							type="button"
							class="w-full rounded-lg border border-gray-200 bg-white px-2 py-4 text-center text-2xl font-extrabold leading-none text-gray-800 shadow-sm"
							:class="isOrderSelected(element?.id) ? 'ring-2 ring-indigo-500' : 'hover:bg-gray-50'"
							@click="onOrderCardActivate(element)"
						>
							{{ element?.id }}
						</button>
					</div>
				</div>
			</div>
		</div>

		<FloatingOrderDetailsPanel
			v-if="visibleOrder"
			ref="panelRef"
			:visible-order="visibleOrder"
			:visible-order-entries="visibleOrderEntries"
			:ingredient-font-size="ingredientFontSize"
			:detail-font-size="detailFontSize"
			:panel-x="panelX"
			:panel-y="panelY"
			:panel-w="panelW"
			:panel-h="panelH"
			:on-panel-pointer-down="onPanelPointerDown"
			:on-panel-pointer-move="onPanelPointerMove"
			:on-panel-pointer-up="onPanelPointerUp"
			:on-panel-lost-pointer-capture="onPanelLostPointerCapture"
			:on-panel-resize-pointer-down="onPanelResizePointerDown"
			:on-panel-resize-pointer-move="onPanelResizePointerMove"
			:on-panel-resize-pointer-up="onPanelResizePointerUp"
			:dec-font="decFont"
			:inc-font="incFont"
			@close-panel="closePanel"
		/>
	</div>
</template>
