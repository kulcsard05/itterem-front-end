<script setup>
import { computed } from 'vue';
import { ORDER_STATUSES } from '../../constants.js';
import { asObject } from '../../utils.js';

const props = defineProps({
	show: { type: Boolean, default: false },
	entityLabel: { type: String, default: '' },
	selectedCount: { type: Number, default: 0 },
	capabilities: {
		type: Object,
		default: () => ({ supportsAvailability: false, supportsPrice: false, supportsStatus: false }),
	},
	form: { type: Object, default: () => ({}) },
	error: { type: String, default: '' },
	saving: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'save', 'update:form']);

const actionOptions = computed(() => {
	const options = [];
	if (props.capabilities?.supportsStatus) {
		options.push({ value: 'status', label: 'Státusz beállítása' });
	}
	if (props.capabilities?.supportsAvailability) {
		options.push({ value: 'availability', label: 'Elérhetőség beállítása' });
	}
	if (props.capabilities?.supportsPrice) {
		options.push({ value: 'increase-amount', label: 'Ár növelése számmal' });
		options.push({ value: 'decrease-amount', label: 'Ár csökkentése számmal' });
		options.push({ value: 'increase-percent', label: 'Ár növelése százalékkal' });
		options.push({ value: 'decrease-percent', label: 'Ár csökkentése százalékkal' });
	}
	return options;
});

const statusOptions = computed(() => ORDER_STATUSES.map((status) => ({ value: status, label: status })));

function updateField(key, value) {
	emit('update:form', { ...asObject(props.form), [key]: value });
}

const selectedActionType = computed(() => {
	const form = asObject(props.form);
	const requested = String(form?.actionType ?? '').trim();
	if (!requested) return actionOptions.value?.[0]?.value ?? '';
	const isAllowed = actionOptions.value.some((option) => option.value === requested);
	return isAllowed ? requested : (actionOptions.value?.[0]?.value ?? '');
});
</script>

<template>
	<div
		v-if="show"
		class="fixed inset-0 z-[1050] flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm"
		@click.self="emit('close')"
	>
		<div class="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl">
			<div class="flex items-center justify-between border-b-2 border-gray-200 p-5">
				<div>
					<h3 class="text-xl font-bold text-gray-800">Tömeges szerkesztés</h3>
					<p class="mt-1 text-sm text-gray-500">{{ selectedCount }} kiválasztott {{ entityLabel.toLowerCase() }} elem</p>
				</div>
				<button
					class="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-2xl text-gray-500 transition hover:bg-gray-200 cursor-pointer"
					@click="emit('close')"
				>
					×
				</button>
			</div>

			<div class="space-y-4 p-5">
				<div class="space-y-2">
					<label class="block text-sm font-semibold text-gray-700">Művelet</label>
					<select
						:value="selectedActionType"
						class="w-full rounded-lg border-2 border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
						@change="updateField('actionType', $event.target.value)"
					>
						<option v-for="option in actionOptions" :key="option.value" :value="option.value">
							{{ option.label }}
						</option>
					</select>
				</div>

				<div v-if="selectedActionType === 'status'" class="space-y-2">
					<label class="block text-sm font-semibold text-gray-700">Új státusz</label>
					<select
						:value="form.status"
						class="w-full rounded-lg border-2 border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
						@change="updateField('status', $event.target.value)"
					>
						<option v-for="option in statusOptions" :key="option.value" :value="option.value">
							{{ option.label }}
						</option>
					</select>
				</div>

				<div v-else-if="selectedActionType === 'availability'" class="space-y-2">
					<label class="block text-sm font-semibold text-gray-700">Elérhetőség</label>
					<select
						:value="form.availability"
						class="w-full rounded-lg border-2 border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
						@change="updateField('availability', $event.target.value)"
					>
						<option value="1">Elérhető</option>
						<option value="0">Nem elérhető</option>
					</select>
				</div>

				<div v-else class="space-y-2">
					<label class="block text-sm font-semibold text-gray-700">
						{{ selectedActionType?.includes('percent') ? 'Százalék (%)' : 'Árváltozás (Ft)' }}
					</label>
					<input
						:value="form.priceValue"
						type="number"
						min="0"
						step="0.01"
						class="w-full rounded-lg border-2 border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
						@input="updateField('priceValue', $event.target.value)"
					/>
					<p class="text-xs text-gray-500">
						A megadott érték minden kijelölt elem jelenlegi árára lesz alkalmazva.
					</p>
				</div>
			</div>

			<div class="border-t-2 border-gray-200 p-5">
				<div v-if="error" class="mb-3 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700" role="alert">
					{{ error }}
				</div>
				<div class="flex justify-end gap-3">
					<button
						class="cursor-pointer rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-200"
						:disabled="saving"
						@click="emit('close')"
					>
						Mégse
					</button>
					<button
						class="cursor-pointer rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:shadow-lg disabled:opacity-50"
						:disabled="saving"
						@click="emit('save')"
					>
						{{ saving ? 'Mentés…' : 'Alkalmazás' }}
					</button>
				</div>
			</div>
		</div>
	</div>
</template>
