<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { asArray, formatCurrency, getItemTypeLabel, readFirstText } from '../../shared/utils.js';

const props = defineProps({
	itemData: {
		type: Object,
		default: null,
	},
});

const emit = defineEmits(['back', 'add-to-cart', 'open-item']);
const { t } = useI18n();

const router = useRouter();

function scrollToPageTop() {
	if (typeof window !== 'undefined') {
		window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
	}
}

onMounted(() => {
	if (!props.itemData) {
		router.replace({ name: 'menu' });
		return;
	}
	scrollToPageTop();
});

watch(
	() => props.itemData,
	(nextItem, prevItem) => {
		if (!nextItem || nextItem === prevItem) return;
		scrollToPageTop();
	},
);

const addedMessage = ref('');
let addedTimer = null;

const itemTitle = computed(() => props.itemData?.name ?? t('menuItem.fallbackTitle'));
const itemImage = computed(() => props.itemData?.image ?? '');
const itemDescription = computed(() => props.itemData?.description ?? t('menu.noDescription'));
const itemPrice = computed(() => props.itemData?.price);
const itemMeta = computed(() => props.itemData?.meta ?? '');
const itemType = computed(() => props.itemData?.type ?? 'item');

const itemIngredients = computed(() => {
	const list = asArray(props.itemData?.ingredients);
	return list.map((v) => String(v ?? '').trim()).filter(Boolean);
});

const itemIngredientsLabel = computed(() => itemIngredients.value.join(', '));

const itemTypeLabel = computed(() => String(props.itemData?.typeLabel ?? '').trim() || getItemTypeLabel(itemType.value));

const HIDE_DESCRIPTION_TYPES = new Set(['menus', 'menu', 'drinks', 'drink']);
const showDescription = computed(() => {
	return !HIDE_DESCRIPTION_TYPES.has(itemType.value.toLowerCase());
});

const isMenuType = computed(() => itemType.value === 'menus' || itemType.value === 'menu');

const menuBreakdown = computed(() => {
	if (!isMenuType.value) return [];

	const predefinedBreakdown = asArray(props.itemData?.menuBreakdown);
	if (predefinedBreakdown.length > 0) {
		return predefinedBreakdown.map((entry) => ({
			key: String(entry?.key ?? ''),
			label: String(entry?.label ?? ''),
			name: readFirstText([entry?.name]) || t('common.notAvailable'),
			description: readFirstText([entry?.description]),
			openPayload: entry?.openPayload ?? null,
		}));
	}

	return [];
});

function addToCart() {
	emit('add-to-cart', props.itemData);
	addedMessage.value = t('menuItem.addedToCart', { name: itemTitle.value });
	clearTimeout(addedTimer);
	addedTimer = setTimeout(() => {
		addedMessage.value = '';
		addedTimer = null;
	}, 3000);
}

onUnmounted(() => clearTimeout(addedTimer));

function openBreakdownEntry(entry) {
	const payload = entry?.openPayload;
	if (!payload) return;
	emit('open-item', payload);
}
</script>

<template>
	<div v-if="props.itemData" class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
		<button
			type="button"
			class="rounded-md px-3 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
			@click="emit('back')"
		>
			{{ t('menuItem.backToMenu') }}
		</button>

		<div class="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
			<img v-if="itemImage" :src="itemImage" :alt="itemTitle" class="h-52 w-full object-cover sm:h-64 md:h-72" />

			<div class="p-6">
				<div class="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">{{ itemTypeLabel }}</div>
				<h1 class="text-2xl font-bold text-gray-900">{{ itemTitle }}</h1>

				<div
					v-if="menuBreakdown.length"
					class="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700"
				>
					<p class="font-semibold text-gray-900">{{ t('menuItem.menuContents') }}</p>
					<ul class="mt-2 space-y-1">
						<li v-for="entry in menuBreakdown" :key="entry.key">
							<button
								type="button"
								class="w-full rounded-md px-2 py-1 text-left hover:bg-white"
								:class="entry.openPayload ? 'cursor-pointer' : 'cursor-default'"
								:disabled="!entry.openPayload"
								@click="openBreakdownEntry(entry)"
							>
								<span class="font-medium">{{ entry.label }}:</span> {{ entry.name }}
								<p v-if="entry.description" class="ml-1 text-xs text-gray-500">{{ entry.description }}</p>
							</button>
						</li>
					</ul>
				</div>

				<div
					v-if="itemIngredients.length"
					class="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700"
				>
					<p class="font-semibold text-gray-900">{{ t('menuItem.ingredients') }}</p>
					<p v-if="itemIngredientsLabel" class="mt-1 text-sm text-gray-700">{{ itemIngredientsLabel }}</p>
				</div>

				<p v-if="showDescription" class="mt-4 text-gray-700">{{ itemDescription }}</p>

				<div class="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
					<p v-if="itemPrice != null" class="text-lg font-semibold text-gray-900">{{ formatCurrency(itemPrice) }}</p>
					<button
						type="button"
						class="inline-flex min-h-11 items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
						@click="addToCart"
					>
						{{ t('menuItem.addToCart') }}
					</button>
				</div>

				<p v-if="addedMessage" class="mt-3 text-sm text-green-700">{{ addedMessage }}</p>
			</div>
		</div>
	</div>
</template>
