<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  itemData: {
    type: Object,
    default: null,
  },
  onBack: {
    type: Function,
    default: undefined,
  },
  onAddToCart: {
    type: Function,
    default: undefined,
  },
});

const addedMessage = ref('');

const itemTitle = computed(() => props.itemData?.name ?? 'Item');
const itemImage = computed(() => props.itemData?.image ?? '');
const itemDescription = computed(() => props.itemData?.description ?? 'No description available.');
const itemPrice = computed(() => props.itemData?.price);
const itemMeta = computed(() => props.itemData?.meta ?? '');
const itemType = computed(() => props.itemData?.type ?? 'item');

const isMenuType = computed(() => itemType.value === 'menus' || itemType.value === 'menu');

const menuBreakdown = computed(() => {
  if (!isMenuType.value) return null;

  const menu = props.itemData?.item ?? {};

  return {
    meal: String(menu?.keszetelNev ?? '-'),
    side: String(menu?.koretNev ?? '-'),
    drink: String(menu?.uditoNev ?? '-'),
  };
});

function addToCart() {
  props.onAddToCart?.(props.itemData);
  addedMessage.value = `${itemTitle.value} added to cart.`;
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
    <button
      type="button"
      class="rounded-md px-3 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
      @click="props.onBack && props.onBack()"
    >
      ← Back to Menu
    </button>

    <div class="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <img
        v-if="itemImage"
        :src="itemImage"
        :alt="itemTitle"
        class="h-72 w-full object-cover"
      />

      <div class="p-6">
        <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">{{ itemType }}</div>
        <h1 class="text-2xl font-bold text-gray-900">{{ itemTitle }}</h1>

        <p v-if="itemMeta" class="mt-2 text-sm text-gray-600">{{ itemMeta }}</p>

        <div
          v-if="menuBreakdown"
          class="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700"
        >
          <p class="font-semibold text-gray-900">Menu contains</p>
          <ul class="mt-2 space-y-1">
            <li><span class="font-medium">Meal:</span> {{ menuBreakdown.meal }}</li>
            <li><span class="font-medium">Side:</span> {{ menuBreakdown.side }}</li>
            <li><span class="font-medium">Drink:</span> {{ menuBreakdown.drink }}</li>
          </ul>
        </div>

        <p class="mt-4 text-gray-700">{{ itemDescription }}</p>

        <div class="mt-6 flex items-center justify-between gap-4">
          <p v-if="itemPrice != null" class="text-lg font-semibold text-gray-900">{{ itemPrice }} Ft</p>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            @click="addToCart"
          >
            Add to cart
          </button>
        </div>

        <p v-if="addedMessage" class="mt-3 text-sm text-green-700">{{ addedMessage }}</p>
      </div>
    </div>
  </div>
</template>
