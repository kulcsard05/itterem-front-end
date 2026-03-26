<script setup>
import { computed, ref } from 'vue';
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
	onPanelLostPointerCapture: {
		type: Function,
		required: true,
	},
	onPanelResizePointerDown: {
		type: Function,
		required: true,
	},
	onPanelResizePointerMove: {
		type: Function,
		required: true,
	},
	onPanelResizePointerUp: {
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

const customerName = computed(() => {
	const value = String(props.visibleOrder?.teljesNev ?? props.visibleOrder?.felhasznaloNev ?? '').trim();
	return value || '-';
});

const customerPhone = computed(() => {
	const value = String(props.visibleOrder?.telefonszam ?? props.visibleOrder?.telefonSzam ?? '').trim();
	return value || '-';
});

defineExpose({
	panelElement,
});
</script>

<template>
	<div
		ref="panelElement"
		class="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
		:style="{ left: panelX + 'px', top: panelY + 'px', width: panelW + 'px', height: panelH + 'px', fontSize: detailFontSize + 'px' }"
		style="min-width: 320px; min-height: 220px; touch-action: manipulation;"
		@pointermove="onPanelPointerMove"
		@pointerup="onPanelPointerUp"
		@pointercancel="onPanelPointerUp"
		@lostpointercapture="onPanelLostPointerCapture"
		@pointermove.capture="onPanelResizePointerMove"
		@pointerup.capture="onPanelResizePointerUp"
		@pointercancel.capture="onPanelResizePointerUp"
	>
		<div
			class="flex cursor-move select-none items-center justify-between gap-3 border-b border-gray-200 bg-gray-900 px-4 py-3 text-white"
			style="touch-action: none;"
			@pointerdown="onPanelPointerDown"
		>
			<div class="flex items-center gap-3">
				<div class="font-semibold">#{{ visibleOrder?.id }}</div>
				<div class="text-white/80">{{ formatDateTime(visibleOrder?.datum) }}</div>
			</div>
			<div class="flex items-center gap-4" data-no-drag="true">
				<button
					type="button"
					class="rounded-md px-3 py-2 font-semibold ring-1 ring-white/30 hover:bg-white/10"
					@click.stop="decFont"
					@pointerdown.stop
					:title="'Betűméret csökkentése'"
				>
					A-
				</button>
				<button
					type="button"
					class="rounded-md px-3 py-2 font-semibold ring-1 ring-white/30 hover:bg-white/10"
					@click.stop="incFont"
					@pointerdown.stop
					:title="'Betűméret növelése'"
				>
					A+
				</button>
				<button
					type="button"
					class="rounded-md px-3 py-2 font-semibold text-red-200 ring-1 ring-white/30 hover:bg-white/10 hover:text-red-100"
					@click.stop="emit('close-panel')"
					@pointerdown.stop
					title="Bezárás"
				>
					X
				</button>
			</div>
		</div>

		<div class="flex-1 overflow-auto p-4">
			<div class="mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
				<div class="font-semibold text-gray-900">{{ customerPhone }}</div>
				<div class="text-gray-700">{{ customerName }}</div>
			</div>

			<div class="flex items-center justify-between gap-3">
				<div class="font-bold text-gray-900">Tételek</div>
				<OrderStatusBadge
					:status="visibleOrder?.statusz"
					base-class="inline-block rounded-full px-3 py-1 text-[0.95em] font-semibold"
				/>
			</div>

			<div class="mt-3">
				<p v-if="visibleOrderEntries.length === 0" class="text-gray-600">
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

		<button
			type="button"
			class="absolute bottom-0 right-0 h-7 w-7 cursor-se-resize touch-none"
			data-no-drag="true"
			aria-label="Panel resize"
			title="Átméretezés"
			@pointerdown.stop="onPanelResizePointerDown('corner', $event)"
		>
			<span class="pointer-events-none absolute bottom-1 right-1 h-3.5 w-3.5 border-b-2 border-r-2 border-gray-500/70" />
		</button>
		<button
			type="button"
			class="absolute right-0 top-12 h-[calc(100%-3rem)] w-3 cursor-e-resize touch-none"
			data-no-drag="true"
			aria-label="Panel width resize"
			title="Szélesség állítása"
			@pointerdown.stop="onPanelResizePointerDown('right', $event)"
		/>
		<button
			type="button"
			class="absolute bottom-0 left-0 h-3 w-[calc(100%-2.5rem)] cursor-s-resize touch-none"
			data-no-drag="true"
			aria-label="Panel height resize"
			title="Magasság állítása"
			@pointerdown.stop="onPanelResizePointerDown('bottom', $event)"
		/>
	</div>
</template>
