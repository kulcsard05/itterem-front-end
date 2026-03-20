import { createIngredient, deleteIngredient, updateIngredient } from '../../api.js';
import { requiredName } from '../../admin-helpers.js';

export function createIngredientConfig() {
	return {
		label: 'Hozzávaló',
		tableTitle: 'Hozzávalók Kezelése',
		addLabel: '+ Új hozzávaló',
		hasImage: false,
		bulk: { canDelete: true, supportsAvailability: false, supportsPrice: false, supportsStatus: false },
		api: { create: createIngredient, update: updateIngredient, delete: deleteIngredient },
		columns: [
			{ key: 'id', label: 'ID' },
			{ key: 'hozzavaloNev', label: 'Név', bold: true },
		],
		formFields: [{ key: 'nev', label: 'Név', type: 'text' }],
		mapItemToForm: (item) => ({
			id: item?.id,
			nev: String(item?.hozzavaloNev ?? ''),
		}),
		defaultForm: () => ({ nev: '' }),
		validate: (form) => requiredName(form),
		buildPayload: (form, isCreate) => {
			const payload = { nev: String(form.nev ?? '').trim() };
			return isCreate ? payload : { ...payload, id: form.id };
		},
		messages: { create: 'Hozzávaló létrehozva.', update: 'Hozzávaló frissítve.', delete: 'Hozzávaló törölve.' },
	};
}
