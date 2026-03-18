<script setup>
const props = defineProps({
	label: { type: String, default: '' },
});

const emit = defineEmits(['quick-order']);

function onClick(event) {
	emit('quick-order', event);
}
</script>

<template>
	<button
		type="button"
		class="inline-flex items-center gap-1 rounded-md bg-sky-400 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-300 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-150"
		@click="onClick"
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4 7h12.8M7 13L5.4 5M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z" />
		</svg>
		{{ label }}
	</button>
</template>