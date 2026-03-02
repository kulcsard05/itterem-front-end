<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import draggable from 'vuedraggable';
import { getMeals, getMenus, getOrders, updateOrderStatus } from '../api.js';
import {
	AUTH_EXPIRED_EVENT,
	findById,
	formatDateTime,
	getApiBaseUrl,
	getOrderItemName,
	getOrderStatusClasses,
	readStoredAuth,
} from '../utils.js';

const props = defineProps({
	auth: { type: Object, default: null },
});

const emit = defineEmits(['logout']);

const loading = ref(false);
const error = ref('');

const pendingOrders = ref([]);
const processingOrders = ref([]);
const readyOrders = ref([]);

const meals = ref([]);
const menus = ref([]);

const selectedOrderId = ref(null);
const detailFontSize = ref(16);

// DEV helper: make it obvious that data arrived via SSE.
const showSseDebug = import.meta.env.DEV;

const sseState = ref('disabled'); // disabled | connecting | open | error
const sseLastEventAt = ref(null);
const sseLastEventLabel = ref('');
const sseLastError = ref('');
const sseSeen = ref(new Map()); // orderId -> timestamp(ms)

const PANEL_PREFS_KEY = 'employeeOrdersPanelPrefs';

let sseClient = null;
let ordersSseAbortController = null;
let statusSseAbortController = null;
let sseReconnectTimer = null;
let sseReconnectAttempt = 0;
const ssePendingRefresh = ref(false);

let sseOpenWatchdogTimer = null;

function getSseToken() {
	// NOTE: The route that renders this page does not pass `auth` as a prop.
	// Our REST API helpers already read auth from localStorage, so SSE must do the same.
	return props.auth?.token ?? readStoredAuth()?.token ?? null;
}

function formatClock(ts) {
	try {
		if (!ts) return '';
		return new Date(ts).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	} catch {
		return '';
	}
}

function markSseOrder(orderId) {
	const key = String(orderId ?? '').trim();
	if (!key) return;
	const next = new Map(sseSeen.value);
	next.set(key, Date.now());
	// Keep map bounded.
	if (next.size > 300) {
		const sorted = Array.from(next.entries()).sort((a, b) => a[1] - b[1]);
		for (let i = 0; i < sorted.length - 250; i += 1) next.delete(sorted[i][0]);
	}
	sseSeen.value = next;
}

function isSseMarked(orderId) {
	const key = String(orderId ?? '').trim();
	if (!key) return false;
	const ts = sseSeen.value.get(key);
	if (!ts) return false;
	return Date.now() - ts < 90_000;
}

async function refreshFromSse({ orderId = null, label = 'SSE' } = {}) {
	sseLastEventAt.value = Date.now();
	sseLastEventLabel.value = label;
	if (orderId != null) markSseOrder(orderId);

	if (savingStatus.value) {
		ssePendingRefresh.value = true;
		return;
	}

	await loadOrders();
}

function stopEmployeeSse() {
	if (sseOpenWatchdogTimer != null) {
		window.clearTimeout(sseOpenWatchdogTimer);
		sseOpenWatchdogTimer = null;
	}
	if (sseReconnectTimer != null) {
		window.clearTimeout(sseReconnectTimer);
		sseReconnectTimer = null;
	}
	if (ordersSseAbortController) {
		try {
			ordersSseAbortController.abort();
		} catch {
			// ignore
		}
		ordersSseAbortController = null;
	}
	if (statusSseAbortController) {
		try {
			statusSseAbortController.abort();
		} catch {
			// ignore
		}
		statusSseAbortController = null;
	}
	if (sseClient) {
		try {
			sseClient.close();
		} catch {
			// ignore
		}
		sseClient = null;
	}
}

function scheduleSseReconnect() {
	if (sseReconnectTimer != null) return;
	sseReconnectAttempt += 1;
	const delay = Math.min(30_000, 750 * 2 ** Math.min(6, sseReconnectAttempt));
	sseReconnectTimer = window.setTimeout(() => {
		sseReconnectTimer = null;
		startEmployeeSse();
	}, delay);
}

function buildSseUrl(path) {
	const baseUrl = getApiBaseUrl();
	const base = String(baseUrl ?? '').replace(/\/+$/, '');
	return `${base}${path}`;
}

function parseSseEventBlock(block) {
	// Basic SSE parser: supports multi-line data, ignores id/retry.
	// https://html.spec.whatwg.org/multipage/server-sent-events.html
	const lines = String(block ?? '').split(/\r?\n/);
	let event = '';
	let data = '';
	for (const line of lines) {
		if (!line) continue;
		if (line.startsWith(':')) continue; // comment / heartbeat
		if (line.startsWith('event:')) {
			const value = line.slice(6);
			event = String(value.startsWith(' ') ? value.slice(1) : value).trim();
			continue;
		}
		if (line.startsWith('data:')) {
			const value = line.slice(5);
			data += `${value.startsWith(' ') ? value.slice(1) : value}\n`;
		}
	}
	// Per spec: final newline is removed.
	if (data.endsWith('\n')) data = data.slice(0, -1);
	return { data, event };
}


async function startFetchSse({ url, token, onOpen, onMessage, onError, onController }) {
	const controller = new AbortController();
	onController?.(controller);

	try {
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				accept: 'text/event-stream',
				Authorization: `Bearer ${token}`,
			},
			signal: controller.signal,
		});

		if (!response.ok) {
			throw new Error(`SSE HTTP hiba: ${response.status}`);
		}

		if (!response.body) {
			throw new Error('SSE válasz body hiányzik.');
		}

		onOpen?.();

		const reader = response.body.getReader();
		const decoder = new TextDecoder('utf-8');
		let buffer = '';

		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			// Normalize line endings so we can reliably split on blank lines.
			buffer = buffer.replace(/\r\n/g, '\n');

			// SSE events are separated by a blank line.
			let idx;
			while ((idx = buffer.indexOf('\n\n')) !== -1) {
				const rawBlock = buffer.slice(0, idx);
				buffer = buffer.slice(idx + 2);
				const evt = parseSseEventBlock(rawBlock);
				onMessage?.(evt);
			}
		}
	} catch (err) {
		// Ignore abort errors (expected on stop/unmount).
		if (controller.signal.aborted) return;
		onError?.(err);
	}
}

function readText(value) {
	return String(value ?? '').trim();
}

function normalizeOrderEntryDto(dto) {
	if (!dto || typeof dto !== 'object') return null;
	return {
		id: dto?.id ?? dto?.Id ?? null,
		rendelesId: dto?.rendelesId ?? dto?.RendelesId ?? null,
		keszetelId: dto?.keszetelId ?? dto?.KeszetelId ?? null,
		uditoId: dto?.uditoId ?? dto?.UditoId ?? null,
		menuId: dto?.menuId ?? dto?.MenuId ?? null,
		koretId: dto?.koretId ?? dto?.KoretId ?? null,
		keszetelNev: dto?.keszetelNev ?? dto?.KeszetelNev ?? null,
		uditoNev: dto?.uditoNev ?? dto?.UditoNev ?? null,
		menuNev: dto?.menuNev ?? dto?.MenuNev ?? null,
		koretNev: dto?.koretNev ?? dto?.KoretNev ?? null,
		mennyiseg: dto?.mennyiseg ?? dto?.Mennyiseg ?? 0,
	};
}

function normalizeOrderDto(dto) {
	if (!dto || typeof dto !== 'object') return null;
	const id = dto?.id ?? dto?.Id ?? null;
	if (id == null) return null;
	const entriesRaw = dto?.rendelesElemeks ?? dto?.RendelesElemeks ?? dto?.rendelesElemek ?? dto?.RendelesElemek ?? [];
	const rendelesElemeks = (Array.isArray(entriesRaw) ? entriesRaw : [])
		.map((e) => normalizeOrderEntryDto(e))
		.filter(Boolean);

	const status = readText(dto?.statusz ?? dto?.Statusz ?? dto?.status ?? dto?.Status);
	return {
		id,
		felhasznaloId: dto?.felhasznaloId ?? dto?.FelhasznaloId ?? null,
		osszesAr: dto?.osszesAr ?? dto?.OsszesAr ?? null,
		datum: dto?.datum ?? dto?.Datum ?? null,
		// Default new orders to pending when backend doesn't send status yet.
		statusz: status || 'Függőben',
		rendelesElemeks,
	};
}

function findOrderLocation(orderId) {
	const idKey = String(orderId ?? '').trim();
	if (!idKey) return null;

	const lists = [
		{ key: 'pending', ref: pendingOrders },
		{ key: 'processing', ref: processingOrders },
		{ key: 'ready', ref: readyOrders },
	];

	for (const list of lists) {
		const arr = Array.isArray(list.ref.value) ? list.ref.value : [];
		const idx = arr.findIndex((o) => String(o?.id ?? '').trim() === idKey);
		if (idx !== -1) return { listRef: list.ref, index: idx, order: arr[idx] };
	}

	return null;
}

function listRefForStatus(statusz) {
	const status = readText(statusz);
	if (status === 'Folyamatban') return processingOrders;
	if (status === 'Átvehető') return readyOrders;
	return pendingOrders;
}

function removeOrderFromLists(orderId) {
	const loc = findOrderLocation(orderId);
	if (!loc) return null;
	const arr = Array.isArray(loc.listRef.value) ? loc.listRef.value : [];
	return arr.splice(loc.index, 1)[0] ?? null;
}

function upsertOrderIntoColumns(normalized) {
	if (!normalized) return;
	const idKey = String(normalized.id ?? '').trim();
	if (!idKey) return;

	const loc = findOrderLocation(idKey);
	if (loc?.order) {
		const prevStatus = readText(loc.order?.statusz);
		// Merge fields; keep existing status when new payload doesn't provide one.
		const nextStatus = readText(normalized.statusz) || prevStatus || 'Függőben';
		const merged = {
			...loc.order,
			...normalized,
			statusz: nextStatus,
		};
		Object.assign(loc.order, merged);

		if (nextStatus === 'Teljesítve') {
			removeOrderFromLists(idKey);
			if (String(selectedOrderId.value ?? '') === idKey) selectedOrderSnapshot.value = merged;
			return;
		}

		if (prevStatus !== nextStatus) {
			const moved = removeOrderFromLists(idKey) ?? merged;
			const target = listRefForStatus(nextStatus);
			target.value.unshift(moved);
		}

		if (String(selectedOrderId.value ?? '') === idKey) selectedOrderSnapshot.value = loc.order;
		return;
	}

	// Not found -> insert.
	if (readText(normalized.statusz) === 'Teljesítve') return;
	const target = listRefForStatus(normalized.statusz);
	target.value.unshift(normalized);
	if (String(selectedOrderId.value ?? '') === idKey) selectedOrderSnapshot.value = normalized;
}

function upsertOrdersIntoColumns(incomingList) {
	const items = Array.isArray(incomingList) ? incomingList : [];
	for (const dto of items) {
		const normalized = normalizeOrderDto(dto);
		upsertOrderIntoColumns(normalized);
	}
}

async function applyStatusUpdate(orderId, nextStatus, label = 'SSE státusz') {
	const idKey = String(orderId ?? '').trim();
	const status = readText(nextStatus);
	if (!idKey || !status) return;

	sseLastEventAt.value = Date.now();
	sseLastEventLabel.value = label;
	markSseOrder(idKey);

	const loc = findOrderLocation(idKey);
	if (!loc?.order) {
		// Order might not be loaded yet (or was completed and removed) -> refresh once.
		await refreshFromSse({ orderId: idKey, label });
		return;
	}

	const prevStatus = readText(loc.order.statusz);
	loc.order.statusz = status;

	if (status === 'Teljesítve') {
		removeOrderFromLists(idKey);
		if (String(selectedOrderId.value ?? '') === idKey) selectedOrderSnapshot.value = { ...loc.order };
		return;
	}

	if (prevStatus !== status) {
		const moved = removeOrderFromLists(idKey) ?? loc.order;
		const target = listRefForStatus(status);
		target.value.unshift(moved);
	}
}

function startEmployeeSse() {
	const token = getSseToken();
	if (!token) {
		sseState.value = 'disabled';
		sseLastError.value = '';
		return;
	}

	const url = buildSseUrl('/api/Rendelesek/stream');
	if (!url) return;

	stopEmployeeSse();
	sseLastError.value = '';
	sseState.value = 'connecting';

	// If the backend doesn't flush immediately, EventSource may stay in "connecting".
	// In that case we fall back to polling after a short grace period.
	sseOpenWatchdogTimer = window.setTimeout(() => {
		if (sseState.value !== 'connecting') return;
		sseState.value = 'error';
		sseLastError.value = 'SSE nem nyílt meg (polling fallback)';
		try {
			sseClient?.close?.();
		} catch {
			// ignore
		}
		sseClient = null;
	}, 8000);

	// Keep `sseClient` as a tiny wrapper so existing stop logic can call .close().
	sseClient = {
		close: () => {
			try {
				ordersSseAbortController?.abort();
			} catch {
				// ignore
			}
		},
	};

	startFetchSse({
		url,
		token,
		onController: (controller) => {
			ordersSseAbortController = controller;
		},
		onOpen: () => {
			if (sseOpenWatchdogTimer != null) {
				window.clearTimeout(sseOpenWatchdogTimer);
				sseOpenWatchdogTimer = null;
			}
			sseState.value = 'open';
			sseReconnectAttempt = 0;
			sseLastEventAt.value = Date.now();
			sseLastEventLabel.value = 'SSE kapcsolódva';
		},
		onMessage: async (event) => {
			sseState.value = 'open';
			sseLastError.value = '';

			const raw = String(event?.data ?? '').trim();
			if (!raw) {
				await refreshFromSse({ label: event?.event ? `SSE ${event.event}` : 'SSE ping' });
				return;
			}

			let payload = null;
			try {
				payload = JSON.parse(raw);
			} catch {
				payload = raw;
			}

			sseLastEventAt.value = Date.now();
			sseLastEventLabel.value = event?.event ? `SSE ${event.event}` : 'SSE frissítés';

			// Backend may send a single new order as a 1-element array.
			if (Array.isArray(payload)) {
				upsertOrdersIntoColumns(payload);
				for (const o of payload) markSseOrder(o?.id ?? o?.Id);
				return;
			}

			const orders = payload?.orders ?? payload?.Orders ?? null;
			if (Array.isArray(orders)) {
				upsertOrdersIntoColumns(orders);
				for (const o of orders) markSseOrder(o?.id ?? o?.Id);
				return;
			}

			// Sometimes payload itself is an order DTO.
			const maybeOrder = normalizeOrderDto(payload);
			if (maybeOrder) {
				upsertOrderIntoColumns(maybeOrder);
				markSseOrder(maybeOrder.id);
				return;
			}

			const orderId = payload?.id ?? payload?.Id ?? payload?.orderId ?? payload?.OrderId ?? payload?.order?.id ?? payload?.order?.Id ?? null;
			await refreshFromSse({ orderId, label: sseLastEventLabel.value || 'SSE frissítés' });
		},
		onError: (err) => {
			if (sseOpenWatchdogTimer != null) {
				window.clearTimeout(sseOpenWatchdogTimer);
				sseOpenWatchdogTimer = null;
			}
			sseState.value = 'error';
			const message = String(err?.message ?? '').trim();
			sseLastError.value = message
				? `SSE hiba: ${message} (újracsatlakozás...)`
				: 'SSE kapcsolat hiba (újracsatlakozás...)';
			sseClient = null;
			scheduleSseReconnect();
		},
	});
}

function startEmployeeStatusSse() {
	const token = getSseToken();
	if (!token) return;

	// Restart status stream only.
	if (statusSseAbortController) {
		try {
			statusSseAbortController.abort();
		} catch {
			// ignore
		}
		statusSseAbortController = null;
	}

	const url = buildSseUrl('/api/Rendelesek/status-stream');
	if (!url) return;

	startFetchSse({
		url,
		token,
		onController: (controller) => {
			statusSseAbortController = controller;
		},
		onMessage: async (event) => {
			const raw = String(event?.data ?? '').trim();
			if (!raw) return;

			let payload = null;
			try {
				payload = JSON.parse(raw);
			} catch {
				payload = raw;
			}

			const orderId = payload?.id ?? payload?.Id ?? payload?.orderId ?? payload?.OrderId ?? payload?.order?.id ?? payload?.order?.Id ?? null;
			const status = readText(
				payload?.statusz ?? payload?.Statusz ?? payload?.status ?? payload?.Status ?? payload?.order?.statusz ?? payload?.order?.Statusz ?? payload?.order?.status ?? payload?.order?.Status,
			);
			if (!orderId || !status) return;
			await applyStatusUpdate(orderId, status, event?.event ? `SSE ${event.event}` : 'SSE státusz');
		},
		onError: () => {
			// Non-fatal: the main orders stream + polling still keep the board updated.
		},
	});
}

const columnOpen = reactive({
	pending: true,
	processing: true,
	ready: true,
});

const columns = [
	{ key: 'pending', label: 'Függőben', status: 'Függőben', headerClass: 'bg-orange-50' },
	{ key: 'processing', label: 'Folyamatban', status: 'Folyamatban', headerClass: 'bg-yellow-50' },
	{ key: 'ready', label: 'Átvehető', status: 'Átvehető', headerClass: 'bg-green-50' },
];

function normalizeOrders(list) {
	pendingOrders.value = [];
	processingOrders.value = [];
	readyOrders.value = [];

	const items = Array.isArray(list) ? list : [];
	for (const order of items) {
		const status = String(order?.statusz ?? '').trim();
		if (status === 'Teljesítve') continue;
		if (status === 'Folyamatban') processingOrders.value.push(order);
		else if (status === 'Átvehető') readyOrders.value.push(order);
		else pendingOrders.value.push(order);
	}
}

function getMealIngredientNames(meal) {
	const list = Array.isArray(meal?.hozzavalok) ? meal.hozzavalok : [];
	return list
		.map((h) => String(h?.hozzavaloNev ?? h?.nev ?? '').trim())
		.filter(Boolean);
}

function getOrderEntryIngredients(entry) {
	if (!entry || typeof entry !== 'object') return [];

	// 1) Direct meal reference/id.
	const mealId = entry?.keszetelId ?? entry?.keszetel?.id ?? null;
	if (mealId != null) {
		const meal = findById(meals.value, mealId);
		return getMealIngredientNames(meal);
	}

	// 2) Menu reference/id -> look up menu -> meal -> ingredients.
	const menuId = entry?.menuId ?? entry?.menu?.id ?? null;
	if (menuId != null) {
		const menu = findById(menus.value, menuId);
		const menuMealId = menu?.keszetelId ?? null;
		if (menuMealId != null) {
			const meal = findById(meals.value, menuMealId);
			return getMealIngredientNames(meal);
		}
	}

	// 3) Fallback: backend might not send ids, only names.
	const mealName = String(entry?.keszetelNev ?? '').trim();
	if (mealName) {
		const meal = (Array.isArray(meals.value) ? meals.value : []).find((m) => String(m?.nev ?? '').trim() === mealName) ?? null;
		return getMealIngredientNames(meal);
	}

	const menuName = String(entry?.menuNev ?? '').trim();
	if (menuName) {
		const menu = (Array.isArray(menus.value) ? menus.value : []).find((m) => String(m?.menuNev ?? '').trim() === menuName) ?? null;
		const menuMealId = menu?.keszetelId ?? null;
		if (menuMealId != null) {
			const meal = findById(meals.value, menuMealId);
			return getMealIngredientNames(meal);
		}
	}

	return [];
}

function getOrderEntryIngredientsLabel(entry) {
	const names = getOrderEntryIngredients(entry);
	return names.length ? names.join(', ') : '';
}

async function loadOrders() {
	error.value = '';
	loading.value = true;
	try {
		const list = await getOrders();
		normalizeOrders(list);
		if (selectedOrderId.value != null && Array.isArray(list)) {
			const found = list.find((o) => String(o?.id ?? '') === String(selectedOrderId.value ?? '')) ?? null;
			if (found) selectedOrderSnapshot.value = found;
		}
	} catch (err) {
		normalizeOrders([]);
		error.value = err?.message || 'Rendelések betöltése sikertelen.';
	} finally {
		loading.value = false;
	}
}

const allOrders = computed(() => [
	...(Array.isArray(pendingOrders.value) ? pendingOrders.value : []),
	...(Array.isArray(processingOrders.value) ? processingOrders.value : []),
	...(Array.isArray(readyOrders.value) ? readyOrders.value : []),
]);

const selectedOrder = computed(() =>
	allOrders.value.find((o) => String(o?.id ?? '') === String(selectedOrderId.value ?? '')) ?? null,
);

const selectedOrderSnapshot = ref(null);

const visibleOrder = computed(() => selectedOrder.value ?? selectedOrderSnapshot.value);

const ingredientFontSize = computed(() => Math.min(32, Math.max(12, detailFontSize.value + 2)));

function closePanel() {
	selectedOrderId.value = null;
	selectedOrderSnapshot.value = null;
}

function formatElapsed(value) {
	const d = new Date(value);
	const ms = d instanceof Date ? d.getTime() : NaN;
	if (!Number.isFinite(ms)) return '-';
	const diff = Math.max(0, Date.now() - ms);
	const totalMin = Math.floor(diff / 60000);
	const hours = Math.floor(totalMin / 60);
	const minutes = totalMin % 60;
	if (hours <= 0) return `${minutes}p`;
	return `${hours}ó ${minutes}p`;
}

function getListRef(key) {
	if (key === 'pending') return pendingOrders;
	if (key === 'processing') return processingOrders;
	return readyOrders;
}

const savingStatus = ref(false);

async function onDraggableChange(event, newStatus) {
	const added = event?.added?.element;
	if (!added) return;
	if (!added?.id) return;

	savingStatus.value = true;
	try {
		const result = await updateOrderStatus(added.id, newStatus);
		if (!result.ok) {
			await loadOrders();
			return;
		}
		added.statusz = newStatus;
	} catch {
		await loadOrders();
	} finally {
		savingStatus.value = false;
		if (ssePendingRefresh.value) {
			ssePendingRefresh.value = false;
			await loadOrders();
		}
	}
}

function toggleColumn(key) {
	columnOpen[key] = !columnOpen[key];
}

// ---------------------------------------------------------------------------
// Floating detail panel (draggable via Pointer Events, resizable via CSS)
// ---------------------------------------------------------------------------

const panelX = ref(24);
const panelY = ref(24);
const panelW = ref(460);
const panelH = ref(280);
const panelRef = ref(null);

let panelResizeObserver = null;

function readPanelPrefs() {
	try {
		const raw = localStorage.getItem(PANEL_PREFS_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === 'object' ? parsed : null;
	} catch {
		return null;
	}
}

function savePanelPrefs() {
	try {
		const payload = {
			x: panelX.value,
			y: panelY.value,
			w: panelW.value,
			h: panelH.value,
			fontSize: detailFontSize.value,
		};
		localStorage.setItem(PANEL_PREFS_KEY, JSON.stringify(payload));
	} catch {
		// ignore
	}
}

const dragging = reactive({
	active: false,
	pointerId: null,
	startX: 0,
	startY: 0,
	baseX: 0,
	baseY: 0,
});

function onPanelPointerDown(e) {
	if (!e?.isPrimary) return;
	// Don't start dragging from the button cluster.
	try {
		const noDrag = e.target?.closest?.('[data-no-drag="true"]');
		if (noDrag) return;
	} catch {
		// ignore
	}
	dragging.active = true;
	dragging.pointerId = e.pointerId;
	dragging.startX = e.clientX;
	dragging.startY = e.clientY;
	dragging.baseX = panelX.value;
	dragging.baseY = panelY.value;
	try {
		e.currentTarget?.setPointerCapture?.(e.pointerId);
	} catch {
		// ignore
	}
}

function onPanelPointerMove(e) {
	if (!dragging.active) return;
	if (dragging.pointerId != null && e.pointerId !== dragging.pointerId) return;

	const dx = e.clientX - dragging.startX;
	const dy = e.clientY - dragging.startY;
	panelX.value = Math.max(0, dragging.baseX + dx);
	panelY.value = Math.max(0, dragging.baseY + dy);
}

function onPanelPointerUp(e) {
	if (dragging.pointerId != null && e.pointerId !== dragging.pointerId) return;
	dragging.active = false;
	dragging.pointerId = null;
	savePanelPrefs();
}

function clampFontSize(next) {
	const value = Number(next);
	if (!Number.isFinite(value)) return detailFontSize.value;
	return Math.min(28, Math.max(12, value));
}

function decFont() {
	detailFontSize.value = clampFontSize(detailFontSize.value - 2);
	savePanelPrefs();
}

function incFont() {
	detailFontSize.value = clampFontSize(detailFontSize.value + 2);
	savePanelPrefs();
}

let pollTimer = null;

onMounted(async () => {
	const prefs = readPanelPrefs();
	if (prefs) {
		if (Number.isFinite(Number(prefs.x))) panelX.value = Math.max(0, Number(prefs.x));
		if (Number.isFinite(Number(prefs.y))) panelY.value = Math.max(0, Number(prefs.y));
		if (Number.isFinite(Number(prefs.w))) panelW.value = Math.max(320, Number(prefs.w));
		if (Number.isFinite(Number(prefs.h))) panelH.value = Math.max(220, Number(prefs.h));
		if (Number.isFinite(Number(prefs.fontSize))) detailFontSize.value = clampFontSize(Number(prefs.fontSize));
	}
	// Default position: bottom-right so it "covers" the bottom area, but remains movable.
	try {
		const hadSavedPos = prefs && (Number.isFinite(Number(prefs.x)) || Number.isFinite(Number(prefs.y)));
		if (!hadSavedPos) {
			panelX.value = Math.max(0, window.innerWidth - panelW.value - 24);
			panelY.value = Math.max(0, window.innerHeight - panelH.value - 24);
		}
	} catch {
		// ignore
	}

	await loadOrders();
	try {
		const [mealsRes, menusRes] = await Promise.allSettled([getMeals(), getMenus()]);
		meals.value = mealsRes.status === 'fulfilled' && Array.isArray(mealsRes.value) ? mealsRes.value : [];
		menus.value = menusRes.status === 'fulfilled' && Array.isArray(menusRes.value) ? menusRes.value : [];
	} catch {
		meals.value = [];
		menus.value = [];
	}
	// Lightweight polling so the board updates without manual refresh.
	pollTimer = window.setInterval(() => {
		if (savingStatus.value) return;
		// Polling is a fallback when SSE is not connected.
		if (sseState.value === 'open' || sseState.value === 'connecting') return;
		loadOrders();
	}, 15000);

	startEmployeeSse();
	startEmployeeStatusSse();

	// Stop streams immediately when auth is cleared/expired.
	try {
		window.addEventListener(AUTH_EXPIRED_EVENT, stopEmployeeSse);
	} catch {
		// ignore
	}
});

onUnmounted(() => {
	stopEmployeeSse();
	try {
		window.removeEventListener(AUTH_EXPIRED_EVENT, stopEmployeeSse);
	} catch {
		// ignore
	}
	if (panelResizeObserver) {
		try {
			panelResizeObserver.disconnect();
		} catch {
			// ignore
		}
		panelResizeObserver = null;
	}
	if (pollTimer != null) window.clearInterval(pollTimer);
});

watch(
	() => props.auth?.token,
	() => {
		// Restart streams when user logs in/out or token changes.
		startEmployeeSse();
		startEmployeeStatusSse();
	},
);

watch(
	() => selectedOrder.value,
	(next) => {
		if (next) selectedOrderSnapshot.value = next;
	},
);

watch(
	() => panelRef.value,
	(el, prev) => {
		if (prev && panelResizeObserver) {
			try {
				panelResizeObserver.disconnect();
			} catch {
				// ignore
			}
			panelResizeObserver = null;
		}
		if (!el) return;
		if (typeof ResizeObserver === 'undefined') return;

		panelResizeObserver = new ResizeObserver((entries) => {
			// Ignore observer updates while the user is moving the panel.
			if (dragging.active) return;

			const entry = entries && entries[0];
			const target = entry?.target;
			let nextW = null;
			let nextH = null;

			// Use border-box size to match our inline width/height (contentRect can cause feedback drift).
			try {
				const box = target?.getBoundingClientRect?.();
				if (box) {
					nextW = box.width;
					nextH = box.height;
				}
			} catch {
				// ignore
			}

			if (!Number.isFinite(nextW) || !Number.isFinite(nextH)) {
				const rect = entry?.contentRect;
				if (!rect) return;
				nextW = rect.width;
				nextH = rect.height;
			}

			const w = Math.max(320, Math.round(nextW));
			const h = Math.max(220, Math.round(nextH));
			if (Math.abs(w - panelW.value) >= 1) panelW.value = w;
			if (Math.abs(h - panelH.value) >= 1) panelH.value = h;
			savePanelPrefs();
		});
		try {
			panelResizeObserver.observe(el);
		} catch {
			// ignore
		}
	},
);
</script>

<template>
	<div class="relative h-[calc(100vh-0px)] overflow-hidden bg-gray-50">
		<!-- DEV: SSE indicator (make it very obvious updates are live) -->
		<teleport to="body">
			<div
				v-if="showSseDebug"
				class="fixed left-0 top-0 z-[60]"
				role="status"
				aria-live="polite"
				title="AZONNALI FRISSÍTÉS"
				aria-label="AZONNALI FRISSÍTÉS"
			>
				<span
					class="inline-flex h-3.5 w-3.5 rounded-full ring-1 ring-gray-300"
					:class="sseState === 'open' ? 'bg-green-500' : sseState === 'connecting' ? 'bg-yellow-500' : sseState === 'disabled' ? 'bg-gray-400' : 'bg-red-500'"
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
							{{ getListRef(col.key).value.length }}
						</div>
					</div>

					<div v-else class="flex w-full items-center justify-center">
						<div class="-rotate-90 whitespace-nowrap text-xs font-semibold text-gray-800">
							{{ col.label }} ({{ getListRef(col.key).value.length }})
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
					<p v-if="loading" class="text-sm text-gray-500">Betöltés…</p>

					<draggable
						v-else
						:list="getListRef(col.key).value"
						group="orders"
						item-key="id"
						:disabled="savingStatus"
						ghost-class="opacity-50"
						:animation="150"
						class="min-h-full min-h-[4.5rem] pb-2"
						@change="(e) => onDraggableChange(e, col.status)"
					>
						<template #item="{ element }">
							<button
								type="button"
								class="mb-3 w-full cursor-grab rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm active:cursor-grabbing"
								:class="
									selectedOrderId != null && String(selectedOrderId) === String(element?.id)
										? 'ring-2 ring-indigo-500'
										: 'hover:bg-gray-50'
								"
								@click="selectedOrderId = element?.id"
							>
								<div class="flex items-start justify-between gap-2">
									<div class="text-base font-bold text-gray-900">#{{ element?.id }}</div>
									<div class="flex items-center gap-2">
										<span
											v-if="showSseDebug && isSseMarked(element?.id)"
											class="inline-flex shrink-0 items-center rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-white"
											title="Ez a kártya SSE esemény miatt frissült"
										>
											SSE
										</span>
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
									<div>Eltelt idő: <span class="font-semibold">{{ formatElapsed(element?.datum) }}</span></div>
									<div class="text-xs text-gray-500">{{ formatDateTime(element?.datum) }}</div>
								</div>
								<div class="mt-2 text-sm text-gray-700">
									Tételek: <span class="font-semibold">{{ Array.isArray(element?.rendelesElemeks) ? element.rendelesElemeks.length : 0 }}</span>
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
					<p v-if="!Array.isArray(visibleOrder?.rendelesElemeks) || visibleOrder.rendelesElemeks.length === 0" class="text-sm text-gray-600">
						Nincs tétel.
					</p>
					<ul v-else class="space-y-2">
						<li
							v-for="(entry, idx) in visibleOrder.rendelesElemeks"
							:key="idx"
							class="flex items-start justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
						>
							<div class="min-w-0">
								<div class="font-semibold text-gray-900">{{ getOrderItemName(entry) }}</div>
								<div v-if="getOrderEntryIngredients(entry).length" class="mt-1 text-gray-700" :style="{ fontSize: ingredientFontSize + 'px' }">
									<ul class="space-y-0.5">
										<li v-for="(name, i) in getOrderEntryIngredients(entry)" :key="i">{{ name }}</li>
									</ul>
								</div>
							</div>
							<div class="shrink-0 text-gray-800">× {{ entry?.mennyiseg ?? 0 }}</div>
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
