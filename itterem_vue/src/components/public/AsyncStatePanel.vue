<script setup>
const props = defineProps({
	isLoading: { type: Boolean, default: false },
	errorText: { type: String, default: '' },
	isEmpty: { type: Boolean, default: false },
	loadingLabel: { type: String, default: '' },
	emptyLabel: { type: String, default: '' },
});
</script>

<template>
	<div
		v-if="isLoading"
		class="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700"
	>
		{{ loadingLabel }}
	</div>

	<div
		v-else-if="errorText"
		class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
	>
		{{ errorText }}
	</div>

	<div
		v-else-if="isEmpty"
		class="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600"
	>
		{{ emptyLabel }}
	</div>

	<slot v-else />
</template>