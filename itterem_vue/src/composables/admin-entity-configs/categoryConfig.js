import { createCategory, deleteCategory, updateCategory } from '../../services/api.js';
import { requiredName } from '../../admin/admin-helpers.js';

export function createCategoryConfig() {
	return {
		label: 'Kategória',
		tableTitle: 'Kategóriák Kezelése',
		addLabel: '+ Új kategória',
		hasImage: false,
		bulk: { canDelete: true, supportsAvailability: false, supportsPrice: false, supportsStatus: false },
		api: { create: createCategory, update: updateCategory, delete: deleteCategory },
		columns: [
			{ key: 'id', label: 'ID' },
			{ key: 'nev', label: 'Név', bold: true },
		],
		formFields: [{ key: 'nev', label: 'Név', type: 'text' }],
		mapItemToForm: (item) => ({
			id: item?.id,
			nev: String(item?.nev ?? ''),
		}),
		defaultForm: () => ({ nev: '' }),
		validate: (form) => requiredName(form),
		buildPayload: (form, isCreate) => {
			const payload = { nev: String(form.nev ?? '').trim() };
			return isCreate ? payload : { ...payload, id: form.id };
		},
		messages: { create: 'Kategória létrehozva.', update: 'Kategória frissítve.', delete: 'Kategória törölve.' },
	};
}
