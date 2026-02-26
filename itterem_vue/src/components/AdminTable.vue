<script setup>
import { computed } from 'vue';

const props = defineProps({
	columns: { type: Array, required: true },
	items: { type: Array, required: true },
	title: { type: String, required: true },
	addLabel: { type: String, required: false, default: '' },
	showCreate: { type: Boolean, required: false, default: true },
	showEdit: { type: Boolean, required: false, default: true },
	showDelete: { type: Boolean, required: false, default: true },
});

const emit = defineEmits(['create', 'edit', 'delete']);

const hasActions = computed(() => props.showEdit || props.showDelete);
</script>

<template>
	<div>
		<div class="flex justify-between items-center mb-6 pb-4 border-b-2 border-gray-200">
			<h2 class="text-3xl font-bold text-gray-800">{{ title }}</h2>
		</div>

		<div class="overflow-x-auto rounded-lg border border-gray-200">
			<table class="w-full border-collapse bg-white">
				<thead class="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
					<tr>
						<th
							v-for="col in columns"
							:key="col.key"
							class="p-4 text-left font-semibold text-sm uppercase tracking-wide"
						>
							{{ col.label }}
						</th>
						<th v-if="hasActions" class="p-4 text-left font-semibold text-sm uppercase tracking-wide">Műveletek</th>
					</tr>
				</thead>

				<tbody>
					<!-- Add new row -->
					<tr v-if="showCreate" class="bg-gray-50 border-b border-gray-200">
						<td :colspan="columns.length + (hasActions ? 1 : 0)" class="p-4">
							<button
								class="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg font-semibold text-sm hover:shadow-md transition cursor-pointer"
								@click="emit('create')"
							>
								{{ addLabel }}
							</button>
						</td>
					</tr>

					<!-- Data rows -->
					<tr
						v-for="item in items"
						:key="item.id"
						class="border-b border-gray-200 hover:bg-gray-50 transition-colors"
					>
						<td v-for="col in columns" :key="col.key" class="p-4 text-gray-700">
							<!-- Custom format function -->
							<template v-if="col.format">{{ col.format(item) }}</template>

							<!-- Available badge -->
							<template v-else-if="col.type === 'available'">
								<span
									:class="[
										'inline-block px-3 py-1 rounded-full text-xs font-semibold',
										item[col.key] ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800',
									]"
								>
									{{ item[col.key] ? 'Igen' : 'Nem' }}
								</span>
							</template>

							<!-- Default text -->
							<template v-else>
								<span :class="{ 'font-semibold': col.bold }">{{ item[col.key] ?? '-' }}</span>
							</template>
						</td>

						<td v-if="hasActions" class="p-4">
							<div class="flex gap-2">
								<button
									v-if="showEdit"
									class="px-3.5 py-1.5 rounded-md text-sm font-semibold bg-blue-100 text-blue-800 hover:bg-blue-200 transition cursor-pointer"
									@click="emit('edit', item)"
								>
									Szerkeszt
								</button>
								<button
									v-if="showDelete"
									class="px-3.5 py-1.5 rounded-md text-sm font-semibold bg-red-100 text-red-800 hover:bg-red-200 transition cursor-pointer"
									@click="emit('delete', item)"
								>
									Töröl
								</button>
							</div>
						</td>
					</tr>

					<!-- Empty state -->
					<tr v-if="items.length === 0">
						<td :colspan="columns.length + (hasActions ? 1 : 0)" class="p-8 text-center text-gray-400 text-sm">Nincs adat.</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>
