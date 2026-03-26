<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Login from './Login.vue';
import Register from './Register.vue';
import OrderStatusBadge from '../common/OrderStatusBadge.vue';
import { getOwnOrders, updatePhone } from '../../services/api.js';
import { useSignalR } from '../../composables/useSignalR.js';
import { extractOrderUpdateEvent } from '../../domain/order/order-dto.js';
import { asArray, formatDateTime, formatOrderItems, getOrderStatusLabel, isValidPhone, resolveUserId, sortOrdersByDateDesc } from '../../shared/utils.js';
import {
	DONE_NOTICE_TIMEOUT_MS,
	ROLE_ADMIN,
	ROLE_EMPLOYEE,
} from '../../config/constants.js';

const props = defineProps({
	auth: { type: Object, default: null },
});

const emit = defineEmits(['login-success', 'logout']);
const { t } = useI18n();

const currentForm = ref('login');
const isEditingPhone = ref(false);
const phoneInput = ref('');
const phoneError = ref('');
const phoneSuccess = ref('');
const phoneSaving = ref(false);
const ownOrders = ref([]);
const ordersLoading = ref(false);
const ordersError = ref('');

// DEV helper: make it obvious that status changes arrived via SignalR.
const showRealtimeDebug = import.meta.env.DEV;

const { connectionState, SIGNALR_CONNECTION_STATE, start, on } = useSignalR();

const realtimeIndicatorClass = computed(() => {
	if (connectionState.value === SIGNALR_CONNECTION_STATE.CONNECTED) return 'bg-green-500';
	if (
		connectionState.value === SIGNALR_CONNECTION_STATE.CONNECTING
		|| connectionState.value === SIGNALR_CONNECTION_STATE.RECONNECTING
	) {
		return 'bg-yellow-500';
	}
	return 'bg-red-500';
});

const orderDoneNotice = ref('');
let noticeTimer = null;
let unsubOrderUpdated = null;

function showDoneNotice(message) {
	orderDoneNotice.value = String(message ?? '').trim();
	if (noticeTimer != null) window.clearTimeout(noticeTimer);
	noticeTimer = window.setTimeout(() => {
		orderDoneNotice.value = '';
		noticeTimer = null;
	}, DONE_NOTICE_TIMEOUT_MS);
}

function handleOrderUpdated(firstArg, secondArg, thirdArg) {
	const { orderId, status } = extractOrderUpdateEvent([firstArg, secondArg, thirdArg]);
	const normalizedId = String(orderId ?? '').trim();
	if (!normalizedId) return;

	// Check if this order belongs to us.
	const list = asArray(ownOrders.value);
	const found = list.find((o) => String(o?.id ?? '').trim() === normalizedId);
	if (!found) return;

	const resolvedStatus = String(status ?? '').trim();
	if (resolvedStatus) {
		ownOrders.value = list.map((order) => (
			String(order?.id ?? '').trim() === normalizedId
				? { ...order, statusz: resolvedStatus }
				: order
		));
		showDoneNotice(t('account.doneNotice', {
			id: normalizedId,
			status: getOrderStatusLabel(resolvedStatus),
		}));
		void loadOwnOrders();
		return;
	}

	// Refresh own orders to get the actual new status.
	void loadOwnOrders()
		.then(() => {
			const updated = asArray(ownOrders.value).find(
				(o) => String(o?.id ?? '').trim() === normalizedId,
			);
			const status = String(updated?.statusz ?? '').trim();
			if (status) {
				showDoneNotice(t('account.doneNotice', { id: normalizedId, status: getOrderStatusLabel(status) }));
			}
		})
		.catch(() => {
			// loadOwnOrders already updates user-facing error state.
		});
}

function getPhoneFromAuth(auth) {
	if (!auth) return '';
	return String(auth.telefonszam ?? '').trim();
}

const currentPhone = computed(() => getPhoneFromAuth(props.auth));
const isAdminAccount = computed(() => Number(props.auth?.jogosultsag) === ROLE_ADMIN);
const isEmployeeAccount = computed(() => Number(props.auth?.jogosultsag) === ROLE_EMPLOYEE);

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
		phoneError.value = t('auth.register.validation.phoneInvalid');
		return;
	}

	const userId = resolveUserId(props.auth);
	if (!userId) {
		phoneError.value = t('account.userIdMissing');
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
		phoneSuccess.value = t('account.phoneSaved');
	} catch (err) {
		phoneError.value = err?.message || t('account.phoneSaveFailed');
	} finally {
		phoneSaving.value = false;
	}
}

function toggleForm() {
	currentForm.value = currentForm.value === 'login' ? 'register' : 'login';
}

const displayedOrders = computed(() =>
	[...asArray(ownOrders.value)].sort(sortOrdersByDateDesc),
);

async function loadOwnOrders() {
	ordersError.value = '';

	if (!props.auth?.token || isAdminAccount.value || isEmployeeAccount.value) {
		ownOrders.value = [];
		ordersLoading.value = false;
		return;
	}

	ordersLoading.value = true;
	try {
		const orders = await getOwnOrders();
		ownOrders.value = asArray(orders);
	} catch (err) {
		ownOrders.value = [];
		ordersError.value = err?.message || t('account.ordersFailed');
	} finally {
		ordersLoading.value = false;
	}
}

watch(
	() => props.auth?.token,
	(newToken) => {
		if (unsubOrderUpdated) {
			unsubOrderUpdated();
			unsubOrderUpdated = null;
		}
		void loadOwnOrders();
		if (newToken && !isAdminAccount.value && !isEmployeeAccount.value) {
			unsubOrderUpdated = on('OrderUpdated', handleOrderUpdated);
			void start();
		}
	},
	{ immediate: true },
);

onUnmounted(() => {
	if (unsubOrderUpdated) unsubOrderUpdated();
	if (noticeTimer != null) window.clearTimeout(noticeTimer);
});
</script>

<template>
	<div class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
		<h1 class="text-2xl font-bold tracking-tight text-gray-900">{{ t('account.title') }}</h1>

		<div
			v-if="props.auth && props.auth.token"
			class="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
		>
			<div>
				<div>
					<div class="text-sm text-gray-600">{{ t('account.signedInAs') }}</div>
					<div class="mt-1 flex flex-wrap items-center gap-2 text-lg font-semibold text-gray-900">
						<span>{{ props.auth.teljesNev || '-' }}</span>
						<span
							v-if="isAdminAccount"
							class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold tracking-[0.2em] text-red-700"
						>
							{{ t('account.adminBadge') }}
						</span>
					</div>
					<div class="mt-1 text-sm text-gray-700">{{ props.auth.email || '-' }}</div>

					<div class="mt-4">
						<div class="text-sm text-gray-600">{{ t('account.phone') }}</div>

						<div v-if="!isEditingPhone" class="mt-1 flex items-center gap-3">
							<div class="text-sm text-gray-900">{{ currentPhone || '-' }}</div>
							<button
								type="button"
								class="min-h-10 rounded-md px-3 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
								@click="startPhoneEdit"
							>
								{{ t('account.editPhone') }}
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
								class="min-h-10 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
								@click="savePhone"
							>
								{{ phoneSaving ? t('common.loading') : t('account.savePhone') }}
							</button>
							<button
								type="button"
								:disabled="phoneSaving"
								class="min-h-10 rounded-md px-3 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
								@click="cancelPhoneEdit"
							>
								{{ t('account.cancelPhone') }}
							</button>
						</div>

						<p v-if="phoneError" class="mt-2 text-sm text-red-600">{{ phoneError }}</p>
						<p v-else-if="phoneSuccess" class="mt-2 text-sm text-green-600">{{ phoneSuccess }}</p>
					</div>
				</div>
			</div>

			<div class="mt-6 text-sm text-gray-600">
				{{ t('account.profileHint') }}
			</div>

			<div class="mt-6 flex justify-start sm:justify-end">
				<button
					type="button"
					class="inline-flex min-h-10 items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
					@click="emit('logout')"
				>
					{{ t('nav.logout') }}
				</button>
			</div>

			<div v-if="!isAdminAccount && !isEmployeeAccount" class="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<h2 class="text-base font-semibold text-gray-900">{{ t('account.ordersTitle') }}</h2>
					<!-- DEV: SignalR indicator (moved next to orders) -->
					<div
						v-if="showRealtimeDebug && props.auth && props.auth.token"
						class="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold tracking-wider text-gray-900 ring-1 ring-gray-300"
						role="status"
						aria-live="polite"
						:title="t('account.realtimeConnectionTitle')"
					>
						<span
							class="inline-flex h-2.5 w-2.5 rounded-full"
							:class="realtimeIndicatorClass"
						/>
						<span>{{ t('account.realtimeUpdates') }}</span>
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

				<p v-if="ordersLoading" class="mt-3 text-sm text-gray-600">{{ t('account.ordersLoading') }}</p>
				<p v-else-if="ordersError" class="mt-3 text-sm text-red-600">{{ ordersError }}</p>
				<p v-else-if="displayedOrders.length === 0" class="mt-3 text-sm text-gray-600">
					{{ t('account.noOrders') }}
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

							</div>
							<div class="text-sm text-gray-600">{{ formatDateTime(order.datum) }}</div>
						</div>
							<div class="mt-1 flex items-center gap-2 text-sm text-gray-700">
								{{ t('account.status') }}
								<OrderStatusBadge
									:status="order.statusz"
									:label="getOrderStatusLabel(order.statusz)"
									base-class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold"
								/>
							</div>
						<div class="mt-1 text-sm text-gray-700">{{ t('account.items', { items: formatOrderItems(order) }) }}</div>
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
