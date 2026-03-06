<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { placeOrder } from '../../api.js';
import { formatCurrency, resolveUserId, getOrderItemIdKey } from '../../utils.js';
import { ORDER_TIMEOUT_MS } from '../../constants.js';

const props = defineProps({
	item: { type: Object, default: null },
	auth: { type: Object, default: null },
});

const emit = defineEmits(['close']);
const { t } = useI18n();

const qty = ref(1);
const ordering = ref(false);
const error = ref('');
const success = ref(false);
const successMessage = ref('');

const total = computed(() => {
	if (!props.item || props.item.price == null) return null;
	return props.item.price * qty.value;
});

function reset() {
	qty.value = 1;
	error.value = '';
	success.value = false;
	successMessage.value = '';
	ordering.value = false;
}

function close() {
	emit('close');
}

function withTimeout(promise, ms) {
	let timeoutId;
	const timeoutPromise = new Promise((_, reject) => {
		timeoutId = setTimeout(() => {
			reject(new Error(t('quickBuy.serverTimeout')));
		}, ms);
	});
	return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

async function confirm() {
	const resolved = resolveUserId(props.auth);
	if (!resolved) {
		error.value = t('quickBuy.loginRequired');
		return;
	}
	const data = props.item;
	if (!data) return;
	const idKey = getOrderItemIdKey(data.type);
	if (!idKey) return;

	ordering.value = true;
	error.value = '';
	try {
		const payload = [{ [idKey]: data.item?.id, mennyiseg: qty.value }];
		const result = await withTimeout(placeOrder(resolved, payload), ORDER_TIMEOUT_MS);
		const apiMessage = typeof result?.message === 'string' ? result.message.trim() : '';
		const orderId = result?.orderId;
		if (apiMessage && orderId != null) {
			successMessage.value = `${apiMessage} (${t('common.orderIdLabel')}: ${orderId})`;
		} else if (apiMessage) {
			successMessage.value = apiMessage;
		} else {
			successMessage.value = t('quickBuy.orderPlaced');
		}
		success.value = true;
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('quickBuy.orderFailed');
	} finally {
		ordering.value = false;
	}
}

// Reset state when the item changes (new modal opened).
defineExpose({ reset });
</script>

<template>
	<Teleport to="body">
		<Transition name="qb-fade">
			<div
				v-if="item"
				class="fixed inset-0 z-50 flex items-center justify-center p-4"
				role="dialog"
				aria-modal="true"
				:aria-label="t('quickBuy.title')"
			>
				<!-- Backdrop -->
				<div
					class="absolute inset-0 bg-black/50"
					@click="close"
				/>

				<!-- Panel -->
				<div class="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl">
					<!-- Header -->
					<div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
						<h2 class="text-base font-semibold text-gray-900">{{ t('quickBuy.title') }}</h2>
						<button
							type="button"
							class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
							@click="close"
							:aria-label="t('common.close')"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
							</svg>
						</button>
					</div>

					<!-- Success state -->
					<div v-if="success" class="flex flex-col items-center gap-3 px-6 py-8 text-center">
						<div class="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
							</svg>
						</div>
						<p class="text-base font-semibold text-gray-900">{{ t('quickBuy.orderPlacedTitle') }}</p>
						<p class="text-sm text-gray-500">{{ successMessage || t('quickBuy.orderPlacedFallback') }}</p>
						<button
							type="button"
							class="mt-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
							@click="close"
						>
							{{ t('common.close') }}
						</button>
					</div>

					<!-- Order form -->
					<div v-else class="px-6 py-5 space-y-5">
						<!-- Item info -->
						<div class="flex items-center gap-4">
							<img
								v-if="item.image"
								:src="item.image"
								:alt="item.name"
								class="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
							/>
							<div v-else class="h-20 w-20 flex-shrink-0 rounded-xl bg-gray-100" />
							<div>
								<p class="text-sm text-gray-500">{{ item.typeLabel }}</p>
								<p class="text-base font-semibold text-gray-900 leading-snug">{{ item.name }}</p>
								<p v-if="item.price != null" class="mt-1 text-sm text-gray-500">
									{{ t('common.unitPrice') }}: <span class="font-medium text-gray-800">{{ formatCurrency(item.price) }}</span>
								</p>
							</div>
						</div>

						<!-- Quantity -->
						<div class="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
							<span class="text-sm font-medium text-gray-700">{{ t('common.quantity') }}</span>
							<div class="flex items-center gap-3">
								<button
									type="button"
									class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
									:disabled="qty <= 1"
									@click="qty > 1 && qty--"
									:aria-label="t('quickBuy.decreaseQuantity')"
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
									</svg>
								</button>
								<span class="w-8 text-center text-base font-bold text-gray-900">{{ qty }}</span>
								<button
									type="button"
									class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100"
									@click="qty++"
									:aria-label="t('quickBuy.increaseQuantity')"
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
									</svg>
								</button>
							</div>
						</div>

						<!-- Total price -->
						<div v-if="total != null" class="flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3">
							<span class="text-sm font-medium text-indigo-700">{{ t('common.total') }}</span>
							<span class="text-xl font-bold text-indigo-700">{{ formatCurrency(total) }}</span>
						</div>

						<!-- Error -->
						<p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
							{{ error }}
						</p>

						<!-- Actions -->
						<div class="flex gap-3 pt-1">
							<button
								type="button"
								class="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
								@click="close"
							>
								{{ t('common.cancel') }}
							</button>
							<button
								type="button"
								class="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60"
								:disabled="ordering"
								@click="confirm"
							>
								{{ ordering ? t('quickBuy.ordering') : t('quickBuy.placeOrder') }}
							</button>
						</div>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
