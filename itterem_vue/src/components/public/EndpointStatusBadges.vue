<script setup>
const props = defineProps({
	items: { type: Array, default: () => [] },
	statusByKey: { type: Object, default: () => ({}) },
});
</script>

<template>
	<div v-if="items.length" class="mt-2 flex flex-wrap gap-2 text-xs">
		<span
			v-for="item in items"
			:key="item.key"
			class="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-gray-600"
		>
			{{ item.label }}: {{ statusByKey[item.key] }}
		</span>
	</div>
</template>