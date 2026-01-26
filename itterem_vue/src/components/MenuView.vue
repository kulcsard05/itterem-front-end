<script setup>
import { computed, ref } from 'vue';

// Static data (visual testing / styling)
const categories = [
  { id: 1, nev: 'Hamburgerek' },
  { id: 2, nev: 'Tészták' },
  { id: 3, nev: 'Üdítők' },
];

const items = [
  {
    id: 1,
    nev: 'Sima Hamburger',
    leiras: 'Sima Hamburger',
    elerheto: 1,
    hozzavaloks: [],
    kategoria: categories[0],
  },
  {
    id: 2,
    nev: 'Bolognai spagetti',
    leiras: 'Bolognai spagetti',
    elerheto: 0,
    hozzavaloks: [],
    kategoria: categories[1],
  },
];

const selectedCategoryId = ref('all');

const filteredItems = computed(() => {
  if (selectedCategoryId.value === 'all') return items;
  return items.filter((it) => String(it.kategoria?.id) === String(selectedCategoryId.value));
});

function isAvailable(item) {
  return item?.elerheto === 1;
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-gray-900">Menu</h1>
        <p class="mt-1 text-sm text-gray-600">Browse items by category.</p>
      </div>

      <div class="w-full sm:w-80">
        <label class="block text-sm font-medium text-gray-900" for="category">Category</label>
        <select
          id="category"
          v-model="selectedCategoryId"
          class="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.nev }}</option>
        </select>
      </div>
    </div>

    <div class="mt-6 flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-full px-3 py-1.5 text-sm font-semibold"
        :class="selectedCategoryId === 'all' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'"
        @click="selectedCategoryId = 'all'"
      >
        All
      </button>
      <button
        v-for="c in categories"
        :key="c.id"
        type="button"
        class="rounded-full px-3 py-1.5 text-sm font-semibold"
        :class="String(selectedCategoryId) === String(c.id) ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'"
        @click="selectedCategoryId = c.id"
      >
        {{ c.nev }}
      </button>
    </div>

    <div class="mt-8">
      <div v-if="filteredItems.length === 0" class="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
        No items found.
      </div>

      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="item in filteredItems" :key="item.id" class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-base font-semibold text-gray-900">{{ item.nev }}</h3>
              <p class="mt-1 text-sm text-gray-600">{{ item.leiras }}</p>
              <p class="mt-2 text-xs text-indigo-700">{{ item.kategoria?.nev }}</p>
            </div>
            <span
              class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
              :class="isAvailable(item) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'"
            >
              {{ isAvailable(item) ? 'Available' : 'Unavailable' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
