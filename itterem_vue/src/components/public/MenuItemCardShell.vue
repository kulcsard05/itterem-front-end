<script setup>
import ImageWithFallback from '../common/ImageWithFallback.vue';

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
		class="group cursor-pointer rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 sm:p-5"
		@click="onOpen"
	>
		<div class="flex flex-col gap-3">
			<div class="flex flex-col justify-between">
				<slot />
			</div>
			<ImageWithFallback
				:src="imageSrc"
				:alt="imageAlt"
				:fallback-label="imageAlt"
				wrapper-class="order-first h-40 w-full flex-shrink-0 rounded-lg sm:h-44"
				img-class="h-full w-full rounded-lg object-cover transition-opacity duration-150"
				skeleton-class="rounded-lg"
				fallback-class="rounded-lg"
			/>
		</div>
	</div>
</template>