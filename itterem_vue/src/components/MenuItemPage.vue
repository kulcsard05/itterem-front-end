<script setup>
import { computed, ref } from 'vue';
import { getListCacheKey } from '../api.js';

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

const hideDescriptionTypes = new Set(['menus', 'menu', 'drinks', 'drink']);
const showDescription = computed(() => {
  return !hideDescriptionTypes.has(String(itemType.value || '').toLowerCase());
});

const isMenuType = computed(() => itemType.value === 'menus' || itemType.value === 'menu');

function readFirstText(candidates = []) {
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (value) return value;
  }
  return '';
}

function readCachedList(endpointPath) {
  try {
    const key = getListCacheKey(endpointPath);
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.data)) return parsed.data;
    return [];
  } catch {
    return [];
  }
}

function findByIdOrName(list, idValue, nameValue) {
  const normalizedId = String(idValue ?? '').trim();
  const normalizedName = String(nameValue ?? '').trim().toLowerCase();

  return (Array.isArray(list) ? list : []).find((item) => {
    const itemId = String(item?.id ?? '').trim();
    const itemName = String(item?.nev ?? '').trim().toLowerCase();

    if (normalizedId && itemId && itemId === normalizedId) return true;
    if (normalizedName && itemName && itemName === normalizedName) return true;
    return false;
  }) ?? null;
}

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

  const menu = props.itemData?.item ?? {};
  const cachedMeals = readCachedList('/api/Keszetelek');
  const cachedSides = readCachedList('/api/Koretek');

  const matchedMeal = findByIdOrName(cachedMeals, menu?.keszetelId, menu?.keszetelNev);
  const matchedSide = findByIdOrName(cachedSides, menu?.koretId, menu?.koretNev);

  const mealName = readFirstText([menu?.keszetelNev, menu?.mealName, menu?.keszetel?.nev, menu?.meal?.nev, matchedMeal?.nev]) || '-';
  const sideName = readFirstText([menu?.koretNev, menu?.sideName, menu?.koret?.nev, menu?.side?.nev, matchedSide?.nev]) || '-';
  const drinkName = readFirstText([menu?.uditoNev, menu?.drinkName, menu?.udito?.nev, menu?.drink?.nev]) || '-';

  const mealDescription =
    readFirstText([menu?.keszetelLeiras, menu?.mealDescription, menu?.keszetel?.leiras, menu?.meal?.leiras, matchedMeal?.leiras]) || '-';
  const sideDescription =
    readFirstText([menu?.koretLeiras, menu?.sideDescription, menu?.koret?.leiras, menu?.side?.leiras, matchedSide?.leiras]) || '-';

  return [
    {
      key: 'meal',
      label: 'Meal',
      name: mealName,
      description: mealDescription,
    },
    {
      key: 'side',
      label: 'Side',
      name: sideName,
      description: sideDescription,
    },
    {
      key: 'drink',
      label: 'Drink',
      name: drinkName,
      description: '',
    },
  ];
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
            Add to cart
          </button>
        </div>

        <p v-if="addedMessage" class="mt-3 text-sm text-green-700">{{ addedMessage }}</p>
      </div>
    </div>
  </div>
</template>
