<script setup>
import { computed } from 'vue';
import AdminFormField from './AdminFormField.vue';
import ErrorAlert from '../common/ErrorAlert.vue';
import { asObject, buildFieldOptionsMap, getFieldOptions as readFieldOptions } from '../../shared/utils.js';

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
	const currentForm = asObject(props.form);
	if (currentForm?.[key] === value) return;
	emit('update:form', { ...currentForm, [key]: value });
}

const resolvedFieldOptions = computed(() => {
	return buildFieldOptionsMap(props.fields);
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
				<AdminFormField
					v-for="field in fields"
					:key="field.key"
					:field="field"
					:model-value="form[field.key]"
					:options="readFieldOptions(resolvedFieldOptions, field.key)"
					@update:model-value="updateField(field.key, $event)"
				/>

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
				<ErrorAlert :message="error" wrapper-class="mb-3" />
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
