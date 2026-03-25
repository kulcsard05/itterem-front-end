<script setup>
import { computed } from 'vue';
import { ORDER_STATUS_CLASSES } from '../../config/constants.js';

const props = defineProps({
	status: { type: [String, Number], default: '' },
	label: { type: String, default: '' },
	baseClass: {
		type: String,
		default: 'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold',
	},
	fallbackClass: {
		type: String,
		default: 'bg-gray-100 text-gray-800',
	},
	extraClass: { type: String, default: '' },
});

const resolvedStatusClass = computed(() => {
	const statusKey = String(props.status ?? '').trim();
	return ORDER_STATUS_CLASSES[statusKey] ?? props.fallbackClass;
});

const resolvedLabel = computed(() => {
	const explicitLabel = String(props.label ?? '').trim();
	if (explicitLabel) return explicitLabel;
	const statusLabel = String(props.status ?? '').trim();
	return statusLabel || '-';
});
</script>

<template>
	<span :class="[baseClass, resolvedStatusClass, extraClass]">
		{{ resolvedLabel }}
	</span>
</template>