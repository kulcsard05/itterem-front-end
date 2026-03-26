<script setup>
import { computed } from 'vue';
import ErrorAlert from '../common/ErrorAlert.vue';

const props = defineProps({
	show: { type: Boolean, default: false },
	title: { type: String, default: 'Megerősítés' },
	message: { type: String, default: 'Biztosan törlöd?' },
	details: { type: Array, default: () => [] },
	detailsTitle: { type: String, default: 'Törlendő elemek' },
	loading: { type: Boolean, default: false },
	error: { type: String, default: '' },
	confirmLabel: { type: String, default: 'Törlés' },
	cancelLabel: { type: String, default: 'Mégse' },
	confirmVariant: { type: String, default: 'danger' },
});

const emit = defineEmits(['confirm', 'cancel']);

const confirmButtonClass = computed(() => {
	if (props.confirmVariant === 'primary') {
		return 'bg-indigo-600 text-white hover:bg-indigo-700';
	}
	if (props.confirmVariant === 'success') {
		return 'bg-emerald-600 text-white hover:bg-emerald-700';
	}
	return 'bg-red-600 text-white hover:bg-red-700';
});

const normalizedDetails = computed(() =>
	props.details.map((detail) => String(detail ?? '').trim()).filter(Boolean),
);
</script>

<template>
	<div
		v-if="show"
		class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1100] p-5"
		@click.self="emit('cancel')"
	>
		<div class="bg-white rounded-2xl shadow-xl max-w-xl w-full animate-fade-in">
			<div class="p-6">
				<h3 class="text-lg font-bold text-gray-800 mb-2">{{ title }}</h3>
				<p class="text-gray-600 text-sm">{{ message }}</p>

				<div v-if="normalizedDetails.length > 0" class="mt-4 rounded-lg border border-red-100 bg-red-50/50">
					<div class="px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-red-700">
						{{ detailsTitle }}
					</div>
					<ul class="max-h-56 overflow-y-auto border-t border-red-100 divide-y divide-red-100">
						<li
							v-for="(detail, index) in normalizedDetails"
							:key="`${index}-${detail}`"
							class="px-3 py-2 text-sm text-gray-700 break-words"
						>
							{{ detail }}
						</li>
					</ul>
				</div>
			</div>

			<ErrorAlert :message="error" wrapper-class="mx-6 mb-4" />
			<div class="flex gap-3 px-6 pb-6 justify-end">
				<button
					class="px-5 py-2.5 rounded-lg font-semibold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition cursor-pointer"
					:disabled="loading"
					@click="emit('cancel')"
				>
					{{ cancelLabel }}
				</button>
				<button
					:class="[
						'px-5 py-2.5 rounded-lg font-semibold text-sm transition cursor-pointer disabled:opacity-50',
						confirmButtonClass,
					]"
					:disabled="loading"
					@click="emit('confirm')"
				>
					{{ loading ? 'Folyamatban…' : confirmLabel }}
				</button>
			</div>
		</div>
	</div>
</template>

<style scoped>
.animate-fade-in {
	animation: fadeIn 0.15s ease-out;
}
@keyframes fadeIn {
	from {
		opacity: 0;
		transform: scale(0.95);
	}
	to {
		opacity: 1;
		transform: scale(1);
	}
}
</style>
