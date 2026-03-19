<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { placeOrder } from '../../api.js';
import { useCart } from '../../composables/useCart.js';
import { usePromiseTimeout } from '../../composables/usePromiseTimeout.js';
import { formatCurrency, getItemTypeLabel, resolveUserId } from '../../utils.js';
import { ORDER_TIMEOUT_MS } from '../../constants.js';

const props = defineProps({
	open: {
		type: Boolean,
		default: false,
	},
	auth: {
		type: Object,
		default: null,
	},
});

const emit = defineEmits(['close', 'order-success']);
const { t } = useI18n();

const { items, totalItems, totalPrice, addItem, decrementItem, removeItem, clearCart, buildOrderItems, resolveImage } = useCart();

const ordering = ref(false);
const orderError = ref('');
const orderSuccess = ref(false);
const orderSuccessMessage = ref('');
const { withTimeout } = usePromiseTimeout();

const resolvedUserId = computed(() => resolveUserId(props.auth));
const hasItems = computed(() => items.value.length > 0);
const canPlaceOrder = computed(() => !!resolvedUserId.value && hasItems.value && !ordering.value);

function resetOrderFeedback() {
	orderError.value = '';
	orderSuccess.value = false;
	orderSuccessMessage.value = '';
}

function formatOrderSuccessMessage(result) {
	const apiMessage = typeof result?.message === 'string' ? result.message.trim() : '';
	const orderId = result?.orderId;

	if (apiMessage && orderId != null) {
		return `${apiMessage} (${t('common.orderIdLabel')}: ${orderId})`;
	}

	if (apiMessage) {
		return apiMessage;
	}

	return t('cart.orderPlaced');
}

function closeAfterSuccess() {
	orderSuccess.value = false;
	orderSuccessMessage.value = '';
	emit('close');
}

async function submitOrder() {
	if (!resolvedUserId.value) {
		orderError.value = t('cart.loginRequired');
		return;
	}
	if (!hasItems.value) return;

	ordering.value = true;
	resetOrderFeedback();

	try {
		const orderItems = buildOrderItems();
		if (!Array.isArray(orderItems) || orderItems.length === 0) {
			orderError.value = t('cart.invalidItems');
			return;
		}
		const result = await withTimeout(placeOrder(resolvedUserId.value, orderItems), ORDER_TIMEOUT_MS, t('quickBuy.serverTimeout'));
		orderSuccessMessage.value = formatOrderSuccessMessage(result);
		orderSuccess.value = true;
		clearCart();
		emit('order-success');
	} catch (err) {
		orderError.value = err instanceof Error ? err.message : t('cart.orderFailed');
	} finally {
		ordering.value = false;
	}
}
</script>

<template>
	<!-- Backdrop -->
	<Transition name="backdrop">
		<div
			v-if="open"
			class="fixed inset-0 z-40 bg-black/40"
			aria-hidden="true"
			@click="emit('close')"
		/>
	</Transition>

	<!-- Drawer -->
	<Transition name="drawer">
		<div
			v-if="open"
			class="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-xl"
			role="dialog"
			aria-modal="true"
			:aria-label="t('nav.cart')"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-gray-200 px-4 py-4">
				<h2 class="text-lg font-semibold text-gray-900">{{ t('cart.title', { count: totalItems }) }}</h2>
				<button
					type="button"
					class="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
					@click="emit('close')"
					:aria-label="t('common.close')"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>
			</div>

			<!-- Empty state -->
			<div v-if="items.length === 0 && !orderSuccess" class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4 7h12.8M7 13L5.4 5M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z" />
				</svg>
				<p class="text-sm text-gray-500">{{ t('cart.empty') }}</p>
			</div>

			<!-- Order success -->
			<div v-else-if="orderSuccess" class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
				<div class="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
				</div>
				<p class="text-base font-semibold text-gray-900">{{ t('cart.orderPlacedTitle') }}</p>
				<p class="text-sm text-gray-500">{{ orderSuccessMessage || t('cart.orderPlacedFallback') }}</p>
				<button
					type="button"
					class="mt-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
					@click="closeAfterSuccess"
				>
					{{ t('common.close') }}
				</button>
			</div>

			<!-- Items list -->
			<ul v-else class="flex-1 divide-y divide-gray-200 overflow-y-auto">
				<li v-for="item in items" :key="`${item.type}-${item.id}`" class="flex items-center gap-3 px-4 py-3">
					<img
						v-if="resolveImage(item)"
						:src="resolveImage(item)"
						:alt="item.name"
						class="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
					/>
					<div v-else class="h-14 w-14 flex-shrink-0 rounded-lg bg-gray-100" />

					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium text-gray-900">{{ item.name }}</p>
						<p class="text-xs text-gray-500">{{ item.typeLabel || getItemTypeLabel(item.type) }}</p>
						<p v-if="item.price != null" class="text-sm font-semibold text-gray-800">
							{{ formatCurrency(item.price * item.quantity) }}
						</p>
					</div>

					<!-- Quantity controls -->
					<div class="flex items-center gap-1">
						<button
							type="button"
							class="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100"
							@click="decrementItem(item.type, item.id)"
							:aria-label="t('cart.decreaseQuantity', { name: item.name })"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
							</svg>
						</button>
						<span class="w-6 text-center text-sm font-semibold">{{ item.quantity }}</span>
						<button
							type="button"
							class="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100"
							@click="addItem(item)"
							:aria-label="t('cart.increaseQuantity', { name: item.name })"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
							</svg>
						</button>
						<button
							type="button"
							class="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500"
							@click="removeItem(item.type, item.id)"
							:aria-label="t('cart.removeItem', { name: item.name })"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</li>
			</ul>

			<!-- Footer: total + checkout -->
			<div v-if="hasItems && !orderSuccess" class="border-t border-gray-200 px-4 py-4 space-y-3">
				<div class="flex items-center justify-between text-sm font-semibold text-gray-900">
					<span>{{ t('common.total') }}</span>
					<span>{{ formatCurrency(totalPrice) }}</span>
				</div>

				<p v-if="orderError" class="text-sm text-red-600">{{ orderError }}</p>

				<p v-if="!resolvedUserId" class="text-xs text-gray-500">{{ t('cart.loginRequired') }}</p>

				<button
					type="button"
					class="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
					:disabled="!canPlaceOrder"
					@click="submitOrder"
				>
					{{ ordering ? t('cart.ordering') : t('cart.placeOrder') }}
				</button>

				<button
					type="button"
					class="w-full rounded-md px-4 py-2 text-sm font-semibold text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50"
					@click="clearCart"
				>
					{{ t('cart.clear') }}
				</button>
			</div>
		</div>
	</Transition>
</template>

<style scoped>
.backdrop-enter-active,
.backdrop-leave-active {
	transition: opacity 0.25s ease;
}
.backdrop-enter-from,
.backdrop-leave-to {
	opacity: 0;
}

.drawer-enter-active,
.drawer-leave-active {
	transition: transform 0.25s ease;
}
.drawer-enter-from,
.drawer-leave-to {
	transform: translateX(100%);
}
</style>
