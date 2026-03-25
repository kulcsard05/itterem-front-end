<script setup>
const props = defineProps({
	message: { type: String, default: '' },
	wrapperClass: { type: String, default: '' },
});
</script>

<template>
	<div
		v-if="message"
		:class="['rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700', wrapperClass]"
		role="alert"
	>
		{{ message }}
	</div>
</template>