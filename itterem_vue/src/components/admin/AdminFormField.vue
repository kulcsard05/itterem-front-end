<script setup>
import { computed, ref } from 'vue';
import { asArray } from '../../shared/utils.js';

const props = defineProps({
	field: { type: Object, required: true },
	modelValue: { type: null, default: '' },
	options: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:modelValue']);

const multiSelectSearchQuery = ref('');

function normalizeSearchText(value) {
	return String(value ?? '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLocaleLowerCase('hu-HU')
		.trim();
}

const filteredMultiSelectOptions = computed(() => {
	if (props.field?.type !== 'multiselect') return props.options;
	const query = normalizeSearchText(multiSelectSearchQuery.value);
	if (!query) return props.options;

	return props.options.filter((option) => {
		const label = normalizeSearchText(option?.label);
		const value = normalizeSearchText(option?.value);
		return label.includes(query) || value.includes(query);
	});
});

function updateValue(value) {
	emit('update:modelValue', value);
}

function toggleMultiSelect(optionValue, checked) {
	const current = asArray(props.modelValue);
	const normalizedValue = String(optionValue);
	const set = new Set(current.map((v) => String(v)));
	if (checked) set.add(normalizedValue);
	else set.delete(normalizedValue);
	updateValue(Array.from(set));
}

function isMultiSelected(optionValue) {
	const values = asArray(props.modelValue).map((value) => String(value));
	return values.includes(String(optionValue));
}
</script>

<template>
	<div class="space-y-2">
		<label class="block text-sm font-semibold text-gray-700">{{ field.label }}</label>

		<textarea
			v-if="field.type === 'textarea'"
			:value="modelValue"
			rows="3"
			class="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition"
			@input="updateValue($event.target.value)"
		/>

		<div v-else-if="field.type === 'multiselect'" class="space-y-2">
			<div class="relative">
				<input
					v-model="multiSelectSearchQuery"
					type="search"
					:placeholder="field.searchPlaceholder || `${field.label} keresése`"
					class="w-full rounded-lg border-2 border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition"
				/>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
				</svg>
			</div>

			<div class="max-h-44 overflow-auto rounded-lg border-2 border-gray-200 bg-white">
				<label
					v-for="opt in filteredMultiSelectOptions"
					:key="opt.value"
					class="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
				>
					<input
						type="checkbox"
						:checked="isMultiSelected(opt.value)"
						@change="toggleMultiSelect(opt.value, $event.target.checked)"
					/>
					<span>{{ opt.label }}</span>
				</label>
				<div v-if="filteredMultiSelectOptions.length === 0" class="px-3 py-4 text-sm text-gray-500">
					Nincs találat.
				</div>
			</div>
		</div>

		<select
			v-else-if="field.type === 'select'"
			:value="modelValue"
			class="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition"
			@change="updateValue($event.target.value)"
		>
			<option v-if="field.placeholder" value="">{{ field.placeholder }}</option>
			<option v-for="opt in options" :key="opt.value" :value="opt.value">
				{{ opt.label }}
			</option>
		</select>

		<input
			v-else-if="field.type === 'number'"
			:value="modelValue"
			type="number"
			:min="field.min"
			:step="field.step"
			class="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition"
			@input="updateValue($event.target.value)"
		/>

		<input
			v-else
			:value="modelValue"
			type="text"
			class="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition"
			@input="updateValue($event.target.value)"
		/>

		<div v-if="field.helpText" class="text-xs text-gray-500">{{ field.helpText }}</div>
	</div>
</template>