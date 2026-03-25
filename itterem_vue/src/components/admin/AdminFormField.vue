<script setup>
import { asArray } from '../../shared/utils.js';

const props = defineProps({
	field: { type: Object, required: true },
	modelValue: { type: null, default: '' },
	options: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:modelValue']);

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
			<div class="max-h-44 overflow-auto rounded-lg border-2 border-gray-200 bg-white">
				<label
					v-for="opt in options"
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