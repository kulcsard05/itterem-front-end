<script setup>
const props = defineProps({
	imageSrc: { type: String, default: '' },
	imageAlt: { type: String, default: '' },
});

const emit = defineEmits(['open']);

function onOpen() {
	emit('open');
}
</script>

<template>
	<div
		class="group cursor-pointer rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-indigo-300"
		@click="onOpen"
	>
		<div class="flex items-stretch justify-between gap-3">
			<div class="flex flex-col justify-between">
				<slot />
			</div>
			<img
				v-if="imageSrc"
				:src="imageSrc"
				:alt="imageAlt"
				class="h-32 w-32 flex-shrink-0 rounded-lg object-cover"
				loading="lazy"
			/>
		</div>
	</div>
</template>