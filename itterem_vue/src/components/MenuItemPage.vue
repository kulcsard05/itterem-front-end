<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getItemTypeLabel, readFirstText } from '../utils.js';

const props = defineProps({
	itemData: {
		type: Object,
		default: null,
	},
});

const emit = defineEmits(['back', 'add-to-cart']);

const router = useRouter();

onMounted(() => {
	if (!props.itemData) {
		router.replace({ name: 'menu' });
	}
});

const addedMessage = ref('');

const itemTitle = computed(() => props.itemData?.name ?? 'Item');
const itemImage = computed(() => props.itemData?.image ?? '');
const itemDescription = computed(() => props.itemData?.description ?? 'Nincs leírás.');
const itemPrice = computed(() => props.itemData?.price);
const itemMeta = computed(() => props.itemData?.meta ?? '');
const itemType = computed(() => props.itemData?.type ?? 'item');

const itemTypeLabel = computed(() => String(props.itemData?.typeLabel ?? '').trim() || getItemTypeLabel(itemType.value));

const hideDescriptionTypes = new Set(['menus', 'menu', 'drinks', 'drink']);
const showDescription = computed(() => {
	return !hideDescriptionTypes.has(itemType.value.toLowerCase());
});

const isMenuType = computed(() => itemType.value === 'menus' || itemType.value === 'menu');

const menuBreakdown = computed(() => {
	if (!isMenuType.value) return [];

	const predefinedBreakdown = Array.isArray(props.itemData?.menuBreakdown) ? props.itemData.menuBreakdown : [];
	if (predefinedBreakdown.length > 0) {
		return predefinedBreakdown.map((entry) => ({
			key: String(entry?.key ?? ''),
			label: String(entry?.label ?? ''),
			name: readFirstText([entry?.name]) || '-',
			description: readFirstText([entry?.description]),
		}));
	}

	return [];
});

function addToCart() {
	emit('add-to-cart', props.itemData);
	addedMessage.value = `${itemTitle.value} hozzáadva a kosárhoz.`;
	setTimeout(() => {
		addedMessage.value = '';
	}, 3000);
}
</script>

<template>
	<div v-if="props.itemData" class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
		<button
			type="button"
			class="rounded-md px-3 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
			@click="emit('back')"
		>
			← Vissza az étlaphoz
		</button>

		<div class="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
			<img v-if="itemImage" :src="itemImage" :alt="itemTitle" class="h-72 w-full object-cover" />

			<div class="p-6">
				<div class="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">{{ itemTypeLabel }}</div>
				<h1 class="text-2xl font-bold text-gray-900">{{ itemTitle }}</h1>

				<!--         <p v-if="itemMeta" class="mt-2 text-sm text-gray-600">{{ itemMeta }}</p> -->

				<div
					v-if="menuBreakdown.length"
					class="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700"
				>
					<p class="font-semibold text-gray-900">Menü tartalma:</p>
					<ul class="mt-2 space-y-1">
						<li v-for="entry in menuBreakdown" :key="entry.key">
							<span class="font-medium">{{ entry.label }}:</span> {{ entry.name }}
							<p v-if="entry.description" class="ml-1 text-xs text-gray-500">{{ entry.description }}</p>
						</li>
					</ul>
				</div>

				<p v-if="showDescription" class="mt-4 text-gray-700">{{ itemDescription }}</p>

				<div class="mt-6 flex items-center justify-between gap-4">
					<p v-if="itemPrice != null" class="text-lg font-semibold text-gray-900">{{ itemPrice }} Ft</p>
					<button
						type="button"
						class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
						@click="addToCart"
					>
						Kosárba
					</button>
				</div>

				<p v-if="addedMessage" class="mt-3 text-sm text-green-700">{{ addedMessage }}</p>
			</div>
		</div>
	</div>
</template>
