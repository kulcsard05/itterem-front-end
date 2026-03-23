<script setup>
import { computed } from 'vue';

const props = defineProps({
	count: { type: Number, default: 0 },
	label: { type: String, default: '' },
	isAnimating: { type: Boolean, default: false },
});

const emit = defineEmits(['add']);

const buttonClass = computed(() => [
	'inline-flex min-h-10 items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-white transition-colors duration-200',
	props.count > 0 ? 'bg-green-500' : 'bg-indigo-600 hover:bg-indigo-500',
	props.isAnimating ? 'cart-pop' : '',
]);

function onClick(event) {
	emit('add', event);
}
</script>

<template>
	<button
		type="button"
		:class="buttonClass"
		@click="onClick"
	>
		<svg
			v-if="count > 0"
			xmlns="http://www.w3.org/2000/svg"
			class="h-3.5 w-3.5"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2.5"
				d="M5 13l4 4L19 7"
			/>
		</svg>
		<span>{{ label }}</span>
	</button>
</template>

<style scoped>
@keyframes cart-pop {
	0%   { transform: scale(1); }
	35%  { transform: scale(1.18); }
	65%  { transform: scale(0.94); }
	100% { transform: scale(1); }
}

.cart-pop {
	animation: cart-pop 0.3s ease-out forwards;
}
</style>