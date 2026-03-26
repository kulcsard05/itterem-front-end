<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({
	src: { type: String, default: '' },
	alt: { type: String, default: '' },
	wrapperClass: { type: String, default: '' },
	imgClass: { type: String, default: '' },
	skeletonClass: { type: String, default: '' },
	fallbackClass: { type: String, default: '' },
	fallbackLabel: { type: String, default: '' },
	loading: { type: String, default: 'lazy' },
	emptyFallbackDelayMs: { type: Number, default: 1200 },
});

const status = ref('loading'); // loading | loaded | error
let emptySrcTimer = null;

const hasSrc = computed(() => String(props.src ?? '').trim().length > 0);
const showImage = computed(() => hasSrc.value && status.value !== 'error');
const showSkeleton = computed(() => status.value === 'loading');
const showFallback = computed(() => status.value === 'error');

function clearEmptySrcTimer() {
	if (!emptySrcTimer) return;
	clearTimeout(emptySrcTimer);
	emptySrcTimer = null;
}

function scheduleEmptyFallback() {
	clearEmptySrcTimer();
	const delay = Number.isFinite(props.emptyFallbackDelayMs) ? Math.max(0, props.emptyFallbackDelayMs) : 1200;
	emptySrcTimer = setTimeout(() => {
		if (!hasSrc.value && status.value === 'loading') {
			status.value = 'error';
		}
	}, delay);
}

function resetStateFromSrc() {
	status.value = 'loading';
	if (!hasSrc.value) {
		scheduleEmptyFallback();
		return;
	}
	clearEmptySrcTimer();
}

function onLoad() {
	clearEmptySrcTimer();
	status.value = 'loaded';
}

function onError() {
	clearEmptySrcTimer();
	status.value = 'error';
}

watch(
	() => props.src,
	() => {
		resetStateFromSrc();
	},
	{ immediate: true },
);

onBeforeUnmount(() => {
	clearEmptySrcTimer();
});
</script>

<template>
	<div :class="['relative overflow-hidden', wrapperClass]">
		<img
			v-if="showImage"
			:src="src"
			:alt="alt"
			:loading="loading"
			:class="[imgClass, status === 'loaded' ? 'opacity-100' : 'opacity-0']"
			@load="onLoad"
			@error="onError"
		/>

		<div
			v-if="showSkeleton"
			:class="['absolute inset-0 animate-pulse bg-gray-200', skeletonClass]"
		/>

		<div
			v-if="showFallback"
			:class="['absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400', fallbackClass]"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					fill-rule="evenodd"
					d="M4 3a2 2 0 00-2 2v8.586l3.293-3.293a1 1 0 011.414 0L10 14.586l1.293-1.293a1 1 0 011.414 0L18 18.586V5a2 2 0 00-2-2H4zm4 4a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"
					clip-rule="evenodd"
				/>
			</svg>
			<span v-if="fallbackLabel" class="sr-only">{{ fallbackLabel }}</span>
		</div>
	</div>
</template>
