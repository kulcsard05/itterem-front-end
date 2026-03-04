<script setup>
defineProps({
	show: { type: Boolean, default: false },
	title: { type: String, default: 'Megerősítés' },
	message: { type: String, default: 'Biztosan törlöd?' },
	loading: { type: Boolean, default: false },
});

const emit = defineEmits(['confirm', 'cancel']);
</script>

<template>
	<div
		v-if="show"
		class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1100] p-5"
		@click.self="emit('cancel')"
	>
		<div class="bg-white rounded-2xl shadow-xl max-w-md w-full animate-fade-in">
			<div class="p-6">
				<h3 class="text-lg font-bold text-gray-800 mb-2">{{ title }}</h3>
				<p class="text-gray-600 text-sm">{{ message }}</p>
			</div>

			<div class="flex gap-3 px-6 pb-6 justify-end">
				<button
					class="px-5 py-2.5 rounded-lg font-semibold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition cursor-pointer"
					:disabled="loading"
					@click="emit('cancel')"
				>
					Mégse
				</button>
				<button
					class="px-5 py-2.5 rounded-lg font-semibold text-sm bg-red-600 text-white hover:bg-red-700 transition cursor-pointer disabled:opacity-50"
					:disabled="loading"
					@click="emit('confirm')"
				>
					{{ loading ? 'Törlés…' : 'Törlés' }}
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
