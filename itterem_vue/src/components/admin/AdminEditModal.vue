<script setup>
import { computed } from 'vue';

const props = defineProps({
	show: { type: Boolean, default: false },
	title: { type: String, default: 'Szerkesztés' },
	error: { type: String, default: '' },
	isCreateMode: { type: Boolean, default: false },
	fields: { type: Array, default: () => [] },
	form: { type: Object, default: () => ({}) },
	showImageUpload: { type: Boolean, default: false },
	imagePreview: { type: String, default: '' },
	saving: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'save', 'image-selected', 'update:form']);

function updateField(key, value) {
	if (props.form?.[key] === value) return;
	emit('update:form', { ...props.form, [key]: value });
}

function toggleMultiSelect(key, optionValue, checked) {
	const current = Array.isArray(props.form?.[key]) ? props.form[key] : [];
	const normalizedValue = String(optionValue);
	const set = new Set(current.map((v) => String(v)));
	if (checked) set.add(normalizedValue);
	else set.delete(normalizedValue);
	updateField(key, Array.from(set));
}

const resolvedFieldOptions = computed(() => {
	const map = {};
	for (const field of props.fields) {
		if (field.type === 'select' || field.type === 'multiselect') {
			map[field.key] = typeof field.options === 'function' ? field.options() : (field.options ?? []);
		}
	}
	return map;
});
</script>

<template>
	<div
		v-if="show"
		class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-5"
		@click.self="emit('close')"
	>
		<div class="bg-white rounded-2xl shadow-xl max-w-[720px] w-full max-h-[90vh] overflow-y-auto">
			<!-- Header -->
			<div class="flex justify-between items-center p-5 border-b-2 border-gray-200">
				<h3 class="text-xl font-bold text-gray-800">{{ title }}</h3>
				<button
					class="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 text-2xl flex items-center justify-center hover:bg-gray-200 transition cursor-pointer"
					@click="emit('close')"
				>
					×
				</button>
			</div>

			<!-- Body -->
			<div class="p-5 space-y-4">
				<!-- ID (read-only, edit mode only) -->
				<div v-if="!isCreateMode" class="space-y-2">
					<label class="block text-sm font-semibold text-gray-700">ID</label>
					<input
						:value="form.id"
						type="text"
						class="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50"
						disabled
					/>
				</div>

				<!-- Dynamic form fields from entity config -->
				<div v-for="field in fields" :key="field.key" class="space-y-2">
					<label class="block text-sm font-semibold text-gray-700">{{ field.label }}</label>

					<textarea
						v-if="field.type === 'textarea'"
						:value="form[field.key]"
						rows="3"
						class="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition"
						@input="updateField(field.key, $event.target.value)"
					/>

					<div v-else-if="field.type === 'multiselect'" class="space-y-2">
						<div class="max-h-44 overflow-auto rounded-lg border-2 border-gray-200 bg-white">
							<label
								v-for="opt in (typeof field.options === 'function' ? field.options() : field.options)"
								:key="opt.value"
								class="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
							>
								<input
									type="checkbox"
									:checked="Array.isArray(form[field.key]) && form[field.key].map(String).includes(String(opt.value))"
									@change="toggleMultiSelect(field.key, opt.value, $event.target.checked)"
								/>
								<span>{{ opt.label }}</span>
							</label>
						</div>
					</div>

					<select
						v-else-if="field.type === 'select'"
						:value="form[field.key]"
						class="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition"
						@change="updateField(field.key, $event.target.value)"
					>
						<option v-if="field.placeholder" value="">{{ field.placeholder }}</option>
						<option v-for="opt in resolvedFieldOptions[field.key]" :key="opt.value" :value="opt.value">
							{{ opt.label }}
						</option>
					</select>

					<input
						v-else-if="field.type === 'number'"
						:value="form[field.key]"
						type="number"
						:min="field.min"
						:step="field.step"
						class="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition"
						@input="updateField(field.key, $event.target.value)"
					/>

					<input
						v-else
						:value="form[field.key]"
						type="text"
						class="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition"
						@input="updateField(field.key, $event.target.value)"
					/>

					<div v-if="field.helpText" class="text-xs text-gray-500">{{ field.helpText }}</div>
				</div>

				<!-- Image section -->
				<template v-if="showImageUpload">
					<div class="space-y-2">
						<label class="block text-sm font-semibold text-gray-700">Jelenlegi kép</label>
						<div
							v-if="imagePreview"
							class="max-w-xs border border-gray-200 rounded-xl overflow-hidden bg-gray-50"
						>
							<img :src="imagePreview" alt="Előnézet" class="block w-full max-h-56 object-cover" />
						</div>
						<div v-else class="text-xs text-gray-500">Nincs kép jelenleg.</div>
					</div>

					<div class="space-y-2">
						<label class="block text-sm font-semibold text-gray-700">Kép feltöltése</label>
						<input
							type="file"
							accept="image/*"
							class="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm"
							@change="emit('image-selected', $event)"
						/>
						<div class="text-xs text-gray-500">
							Az API a kep mezőt IFormFile / string($binary) formában várja.
						</div>
						<div v-if="form.kepFile" class="text-xs text-gray-500">
							Kiválasztva: {{ form.kepFile.name }}
						</div>
						<div v-if="!isCreateMode" class="text-xs text-gray-500">
							Szerkesztésnél opcionális, létrehozásnál kötelező.
						</div>
					</div>
				</template>
			</div>

			<!-- Footer -->
			<div class="p-5 border-t-2 border-gray-200">
				<div v-if="error" class="mb-3 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700" role="alert">
					{{ error }}
				</div>
				<div class="flex gap-3 justify-end">
					<button
						class="px-5 py-2.5 rounded-lg font-semibold text-sm bg-gray-100 text-gray-500 hover:bg-gray-200 transition cursor-pointer"
						:disabled="saving"
						@click="emit('close')"
					>
						Mégse
					</button>
					<button
						class="px-5 py-2.5 rounded-lg font-semibold text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:shadow-lg transition cursor-pointer disabled:opacity-50"
						:disabled="saving"
						@click="emit('save')"
					>
						{{ saving ? 'Mentés…' : isCreateMode ? 'Létrehozás' : 'Mentés' }}
					</button>
				</div>
			</div>
		</div>
	</div>
</template>
