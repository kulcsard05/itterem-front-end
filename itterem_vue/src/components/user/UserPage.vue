<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import Login from './Login.vue';
import Register from './Register.vue';
import { getOwnOrders, updatePhone } from '../../api.js';
import { startFetchSse } from '../../composables/useFetchSse.js';
import { useSseSeen } from '../../composables/useSseSeen.js';
import { formatDateTime, formatOrderItems, getApiBaseUrl, getOrderStatusClasses, isValidPhone, resolveUserId, sortOrdersByDateDesc } from '../../utils.js';
import {
	SSE_MAX_RECONNECT_DELAY,
	SSE_BASE_RECONNECT_DELAY,
	SSE_MAX_RECONNECT_EXPONENT,
	SSE_SEEN_MAP_LIMIT,
	SSE_SEEN_MAP_TRIM_TO,
	SSE_MARK_DURATION,
	DONE_NOTICE_TIMEOUT_MS,
} from '../../constants.js';

const props = defineProps({
	auth: { type: Object, default: null },
});

const emit = defineEmits(['login-success', 'logout']);

const currentForm = ref('login');
const isEditingPhone = ref(false);
const phoneInput = ref('');
const phoneError = ref('');
const phoneSuccess = ref('');
const phoneSaving = ref(false);
const ownOrders = ref([]);
const ordersLoading = ref(false);
const ordersError = ref('');

// DEV helper: make it obvious that status changes arrived via SSE.
const showSseDebug = import.meta.env.DEV;

const statusSseState = ref('idle'); // idle | connecting | open | error
const statusSseLastEventAt = ref(null);
const statusSseLastError = ref('');
const { markSeen: markStatusSseOrder, isSeenMarked: isStatusSseMarked } = useSseSeen({
	limit: SSE_SEEN_MAP_LIMIT,
	trimTo: SSE_SEEN_MAP_TRIM_TO,
	markDuration: SSE_MARK_DURATION,
});

const orderDoneNotice = ref('');
let noticeTimer = null;

let statusSseAbortController = null;
let statusSseReconnectTimer = null;
let statusSseReconnectAttempt = 0;

function showDoneNotice(message) {
	orderDoneNotice.value = String(message ?? '').trim();
	if (noticeTimer != null) window.clearTimeout(noticeTimer);
	noticeTimer = window.setTimeout(() => {
		orderDoneNotice.value = '';
		noticeTimer = null;
	}, DONE_NOTICE_TIMEOUT_MS);
}

function stopStatusSse() {
	if (statusSseReconnectTimer != null) {
		window.clearTimeout(statusSseReconnectTimer);
		statusSseReconnectTimer = null;
	}
	if (statusSseAbortController) {
		try {
			statusSseAbortController.abort();
		} catch {
			// ignore
		}
		statusSseAbortController = null;
	}
}

function scheduleStatusSseReconnect() {
	if (statusSseReconnectTimer != null) return;
	statusSseReconnectAttempt += 1;
	const delay = Math.min(SSE_MAX_RECONNECT_DELAY, SSE_BASE_RECONNECT_DELAY * 2 ** Math.min(SSE_MAX_RECONNECT_EXPONENT, statusSseReconnectAttempt));
	statusSseReconnectTimer = window.setTimeout(() => {
		statusSseReconnectTimer = null;
		startStatusSse();
	}, delay);
}

function buildStatusSseUrl() {
	const baseUrl = getApiBaseUrl();
	const base = String(baseUrl ?? '').replace(/\/+$/, '');
	return `${base}/api/Rendelesek/status-stream`;
}

const ownOrderIdSet = computed(() => {
	const set = new Set();
	for (const o of Array.isArray(ownOrders.value) ? ownOrders.value : []) {
		const id = String(o?.id ?? '').trim();
		if (id) set.add(id);
	}
	return set;
});

function applyStatusUpdateToOwnOrders(orderId, nextStatus) {
	const normalizedId = String(orderId ?? '').trim();
	const status = String(nextStatus ?? '').trim();
	if (!normalizedId || !status) return false;

	const list = Array.isArray(ownOrders.value) ? ownOrders.value : [];
	let changed = false;
	const next = list.map((order) => {
		if (String(order?.id ?? '').trim() !== normalizedId) return order;
		if (String(order?.statusz ?? '').trim() === status) return order;
		changed = true;
		return { ...(order || {}), statusz: status };
	});

	if (changed) ownOrders.value = next;
	return changed;
}

function startStatusSse() {
	if (!props.auth?.token) {
		statusSseState.value = 'idle';
		statusSseLastError.value = '';
		return;
	}

	stopStatusSse();
	statusSseState.value = 'connecting';
	statusSseLastError.value = '';

	const url = buildStatusSseUrl();
	const token = String(props.auth.token ?? '').trim();

	startFetchSse({
		url,
		token,
		onController: (controller) => {
			statusSseAbortController = controller;
		},
		onOpen: () => {
			statusSseState.value = 'open';
			statusSseReconnectAttempt = 0;
			statusSseLastEventAt.value = Date.now();
		},
		onMessage: ({ data }) => {
			statusSseState.value = 'open';
			statusSseLastError.value = '';
			statusSseLastEventAt.value = Date.now();

			const raw = String(data ?? '').trim();
			if (!raw) return;

			let payload = null;
			try {
				payload = JSON.parse(raw);
			} catch {
				payload = raw;
			}

			const orderId = payload?.id ?? payload?.orderId ?? payload?.order?.id ?? null;
			const status = String(payload?.statusz ?? payload?.status ?? payload?.order?.statusz ?? '').trim();
			if (orderId != null) markStatusSseOrder(orderId);

			const normalizedId = String(orderId ?? '').trim();
			if (!normalizedId) return;
			if (!ownOrderIdSet.value.has(normalizedId)) return;

			// Update the rendered list immediately (otherwise the UI keeps the old status).
			applyStatusUpdateToOwnOrders(normalizedId, status);

			if (status === 'Átvehető' || status === 'Teljesítve') {
				showDoneNotice(`A rendelésed elkészült: #${normalizedId} (${status}) — SSE`);
			}
		},
		onError: (err) => {
			statusSseState.value = 'error';
			statusSseLastError.value = err?.message || 'SSE kapcsolat hiba (újracsatlakozás...)';
			statusSseAbortController = null;
			scheduleStatusSseReconnect();
		},
	}).catch(() => {
		// Handled by onError
	});
}

function getPhoneFromAuth(auth) {
	if (!auth) return '';
	return String(auth.telefonszam ?? '').trim();
}

const currentPhone = computed(() => getPhoneFromAuth(props.auth));

watch(
	() => props.auth,
	(next) => {
		if (!isEditingPhone.value) {
			phoneInput.value = getPhoneFromAuth(next);
		}
	},
	{ immediate: true, deep: true },
);

function startPhoneEdit() {
	phoneError.value = '';
	phoneSuccess.value = '';
	phoneInput.value = currentPhone.value;
	isEditingPhone.value = true;
}

function cancelPhoneEdit() {
	phoneError.value = '';
	phoneInput.value = currentPhone.value;
	isEditingPhone.value = false;
}

async function savePhone() {
	phoneError.value = '';
	phoneSuccess.value = '';

	const nextPhone = phoneInput.value.trim();
	if (!isValidPhone(nextPhone)) {
		phoneError.value = 'Kérjük, adj meg egy érvényes telefonszámot.';
		return;
	}

	const userId = resolveUserId(props.auth);
	if (!userId) {
		phoneError.value = 'Felhasználó azonosító nem található.';
		return;
	}

	phoneSaving.value = true;

	try {
		await updatePhone({ id: userId, telefonszam: nextPhone });

		const updatedUser = {
			...(props.auth || {}),
			telefonszam: nextPhone,
		};

		emit('login-success', updatedUser);
		isEditingPhone.value = false;
		phoneSuccess.value = 'Telefonszám mentve.';
	} catch (err) {
		phoneError.value = err?.message || 'Telefonszám frissítése sikertelen.';
	} finally {
		phoneSaving.value = false;
	}
}

function toggleForm() {
	currentForm.value = currentForm.value === 'login' ? 'register' : 'login';
}

// formatDateTime / formatOrderItems moved to utils.js

const displayedOrders = computed(() =>
	[...(Array.isArray(ownOrders.value) ? ownOrders.value : [])].sort(sortOrdersByDateDesc),
);

async function loadOwnOrders() {
	ordersError.value = '';

	if (!props.auth?.token) {
		ownOrders.value = [];
		ordersLoading.value = false;
		return;
	}

	ordersLoading.value = true;
	try {
		const orders = await getOwnOrders();
		ownOrders.value = Array.isArray(orders) ? orders : [];
	} catch (err) {
		ownOrders.value = [];
		ordersError.value = err?.message || 'Saját rendelések betöltése sikertelen.';
	} finally {
		ordersLoading.value = false;
	}
}

watch(
	() => props.auth?.token,
	() => {
		loadOwnOrders();
		startStatusSse();
	},
	{ immediate: true },
);

onUnmounted(() => {
	stopStatusSse();
	if (noticeTimer != null) window.clearTimeout(noticeTimer);
});
</script>

<template>
	<div class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
		<h1 class="text-2xl font-bold tracking-tight text-gray-900">Fiókom</h1>

		<div
			v-if="props.auth && props.auth.token"
			class="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
		>
			<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<div class="text-sm text-gray-600">Bejelentkezve mint</div>
					<div class="mt-1 text-lg font-semibold text-gray-900">{{ props.auth.teljesNev || '-' }}</div>
					<div class="mt-1 text-sm text-gray-700">{{ props.auth.email || '-' }}</div>

					<div class="mt-4">
						<div class="text-sm text-gray-600">Telefonszám</div>

						<div v-if="!isEditingPhone" class="mt-1 flex items-center gap-3">
							<div class="text-sm text-gray-900">{{ currentPhone || '-' }}</div>
							<button
								type="button"
								class="rounded-md px-2.5 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
								@click="startPhoneEdit"
							>
								Szerkesztés
							</button>
						</div>

						<div v-else class="mt-2 flex flex-wrap items-start gap-2">
							<input
								v-model="phoneInput"
								type="tel"
								autocomplete="tel"
								:disabled="phoneSaving"
								class="w-full max-w-xs rounded-md border-0 px-3 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 disabled:opacity-50"
							/>
							<button
								type="button"
								:disabled="phoneSaving"
								class="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
								@click="savePhone"
							>
								{{ phoneSaving ? 'Mentés…' : 'Mentés' }}
							</button>
							<button
								type="button"
								:disabled="phoneSaving"
								class="rounded-md px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
								@click="cancelPhoneEdit"
							>
								Mégse
							</button>
						</div>

						<p v-if="phoneError" class="mt-2 text-sm text-red-600">{{ phoneError }}</p>
						<p v-else-if="phoneSuccess" class="mt-2 text-sm text-green-600">{{ phoneSuccess }}</p>
					</div>
				</div>

				<button
					type="button"
					class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
					@click="emit('logout')"
				>
					Kijelentkezés
				</button>
			</div>

			<div class="mt-6 text-sm text-gray-600">
				Ez a felhasználói oldalad. Később bővítheted rendelésekkel, kedvencekkel stb.
			</div>

			<div class="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<h2 class="text-base font-semibold text-gray-900">Rendeléseim</h2>
					<!-- DEV: status SSE indicator (moved next to orders) -->
					<div
						v-if="showSseDebug && props.auth && props.auth.token"
						class="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold tracking-wider text-gray-900 ring-1 ring-gray-300"
						role="status"
						aria-live="polite"
						title="SSE státusz stream"
					>
						<span
							class="inline-flex h-2.5 w-2.5 rounded-full"
							:class="statusSseState === 'open' ? 'bg-green-500' : statusSseState === 'connecting' ? 'bg-yellow-500' : statusSseState === 'idle' ? 'bg-gray-400' : 'bg-red-500'"
						/>
						<span>AZONNALI FRISSÍTÉS</span>
						<span v-if="statusSseLastEventAt" class="font-semibold text-gray-600">({{ new Date(statusSseLastEventAt).toLocaleTimeString('hu-HU') }})</span>
						<span v-if="statusSseLastError" class="ml-2 font-semibold text-red-700">{{ statusSseLastError }}</span>
					</div>
				</div>

				<div
					v-if="orderDoneNotice"
					class="mt-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-900"
					role="status"
					aria-live="polite"
				>
					{{ orderDoneNotice }}
				</div>

				<p v-if="ordersLoading" class="mt-3 text-sm text-gray-600">Rendelések betöltése…</p>
				<p v-else-if="ordersError" class="mt-3 text-sm text-red-600">{{ ordersError }}</p>
				<p v-else-if="displayedOrders.length === 0" class="mt-3 text-sm text-gray-600">
					Még nincs saját rendelésed.
				</p>

				<div v-else class="mt-3 space-y-3">
					<div
						v-for="order in displayedOrders"
						:key="order.id"
						class="rounded-md border border-gray-200 bg-white p-3"
					>
						<div class="flex flex-wrap items-center justify-between gap-2">
							<div class="flex items-center gap-2">
								<div class="text-sm font-semibold text-gray-900">#{{ order.id }}</div>
								<span
									v-if="showSseDebug && isStatusSseMarked(order.id)"
									class="inline-flex items-center rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-white"
									title="Ez a rendelés SSE esemény miatt frissült"
								>
									SSE
								</span>
							</div>
							<div class="text-sm text-gray-600">{{ formatDateTime(order.datum) }}</div>
						</div>
							<div class="mt-1 flex items-center gap-2 text-sm text-gray-700">
								Státusz:
								<span
									:class="[
										'inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold',
										getOrderStatusClasses(order.statusz),
									]"
								>{{ order.statusz || '-' }}</span>
							</div>
						<div class="mt-1 text-sm text-gray-700">Tételek: {{ formatOrderItems(order) }}</div>
					</div>
				</div>
			</div>
		</div>

		<div v-else class="mt-8 flex justify-center">
			<Login
				v-if="currentForm === 'login'"
				@switch="toggleForm"
				@login-success="(user) => emit('login-success', user)"
			/>
			<Register v-else @switch="toggleForm" />
		</div>
	</div>
</template>
