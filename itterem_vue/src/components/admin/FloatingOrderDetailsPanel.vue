<script setup>
import { ref } from 'vue';
import OrderStatusBadge from '../common/OrderStatusBadge.vue';
import { formatDateTime } from '../../shared/utils.js';

const props = defineProps({
	visibleOrder: {
		type: Object,
		default: null,
	},
	visibleOrderEntries: {
		type: Array,
		default: () => [],
	},
	ingredientFontSize: {
		type: Number,
		required: true,
	},
	detailFontSize: {
		type: Number,
		required: true,
	},
	panelX: {
		type: Number,
		required: true,
	},
	panelY: {
		type: Number,
		required: true,
	},
	panelW: {
		type: Number,
		required: true,
	},
	panelH: {
		type: Number,
		required: true,
	},
	onPanelPointerDown: {
		type: Function,
		required: true,
	},
	onPanelPointerMove: {
		type: Function,
		required: true,
	},
	onPanelPointerUp: {
		type: Function,
		required: true,
	},
	decFont: {
		type: Function,
		required: true,
	},
	incFont: {
		type: Function,
		required: true,
	},
});

const emit = defineEmits(['close-panel']);

const panelElement = ref(null);

defineExpose({
	panelElement,
});
</script>

<template>
	<div
		ref="panelElement"
		class="fixed z-50 flex flex-col overflow-hidden resize rounded-xl border border-gray-200 bg-white shadow-2xl"
		:style="{ left: panelX + 'px', top: panelY + 'px', width: panelW + 'px', height: panelH + 'px' }"
		style="min-width: 320px; min-height: 220px;"
	>
		<div
			class="flex cursor-move select-none items-center justify-between gap-3 border-b border-gray-200 bg-gray-900 px-3 py-2 text-white"
			@pointerdown="onPanelPointerDown"
			@pointermove="onPanelPointerMove"
			@pointerup="onPanelPointerUp"
			@pointercancel="onPanelPointerUp"
		>
			<div class="flex items-center gap-3">
				<div class="text-sm font-semibold">#{{ visibleOrder?.id }}</div>
				<div class="text-xs text-white/80">{{ formatDateTime(visibleOrder?.datum) }}</div>
			</div>
			<div class="flex items-center gap-2" data-no-drag="true">
				<button
					type="button"
					class="rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-white/30 hover:bg-white/10"
					@click.stop="decFont"
					@pointerdown.stop
					:title="'Betűméret csökkentése'"
				>
					A-
				</button>
				<button
					type="button"
					class="rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-white/30 hover:bg-white/10"
					@click.stop="incFont"
					@pointerdown.stop
					:title="'Betűméret növelése'"
				>
					A+
				</button>
				<button
					type="button"
					class="rounded-md px-2 py-1 text-xs font-semibold text-red-200 ring-1 ring-white/30 hover:bg-white/10 hover:text-red-100"
					@click.stop="emit('close-panel')"
					@pointerdown.stop
					title="Bezárás"
				>
					X
				</button>
			</div>
		</div>

		<div class="flex-1 overflow-auto p-4" :style="{ fontSize: detailFontSize + 'px' }">
			<div class="flex items-center justify-between gap-3">
				<div class="text-base font-bold text-gray-900">Tételek</div>
				<OrderStatusBadge
					:status="visibleOrder?.statusz"
					base-class="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
				/>
			</div>

			<div class="mt-3">
				<p v-if="visibleOrderEntries.length === 0" class="text-sm text-gray-600">
					Nincs tétel.
				</p>
				<ul v-else class="space-y-2">
					<li
						v-for="entryView in visibleOrderEntries"
						:key="entryView.entry.id"
						class="flex items-start justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
					>
						<div class="min-w-0">
							<div class="font-semibold text-gray-900">{{ entryView.itemName }}</div>
							<div v-if="entryView.ingredients.length" class="mt-1 text-gray-700" :style="{ fontSize: ingredientFontSize + 'px' }">
								<ul class="space-y-0.5">
									<li v-for="name in entryView.ingredients" :key="`${entryView.entry.id ?? 'entry'}-${name}`">{{ name }}</li>
								</ul>
							</div>
						</div>
						<div class="shrink-0 text-gray-800">× {{ entryView.entry?.mennyiseg ?? 0 }}</div>
					</li>
				</ul>
			</div>
		</div>
	</div>
</template>
