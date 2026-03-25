import { createDrink, deleteDrink, updateDrink } from '../../services/api.js';
import {
	buildBasePayload,
	normalizeAvailable,
	normalizePriceValue,
	requiredImageOnCreate,
	requiredName,
	requiredPrice,
	validateAll,
	formatPrice,
} from '../../admin/admin-helpers.js';
import { getImageSrcFromItem } from '../../shared/utils.js';
import { AVAILABLE_OPTIONS } from './shared.js';

export function createDrinkConfig() {
	return {
		label: 'Üdítő',
		tableTitle: 'Üdítők Kezelése',
		addLabel: '+ Új üdítő',
		hasImage: true,
		bulk: { canDelete: true, supportsAvailability: true, supportsPrice: true, supportsStatus: false },
		api: { create: createDrink, update: updateDrink, delete: deleteDrink },
		columns: [
			{ key: 'id', label: 'ID' },
			{ key: 'nev', label: 'Név', bold: true },
			{ key: 'ar', label: 'Ár', format: (item) => formatPrice(item.ar) },
			{ key: 'elerheto', label: 'Elérhető', type: 'available' },
		],
		formFields: [
			{ key: 'nev', label: 'Név', type: 'text' },
			{ key: 'elerheto', label: 'Elérhető', type: 'select', options: AVAILABLE_OPTIONS },
			{ key: 'ar', label: 'Ár (Ft)', type: 'number', min: 0, step: 1 },
		],
		mapItemToForm: (item) => ({
			id: item?.id,
			nev: String(item?.nev ?? ''),
			elerheto: normalizeAvailable(item?.elerheto) ? 1 : 0,
			ar: normalizePriceValue(item?.ar),
			kepFile: null,
			currentImageUrl: getImageSrcFromItem(item, 'kep'),
		}),
		defaultForm: () => ({
			nev: '',
			elerheto: 1,
			ar: '',
			kepFile: null,
			currentImageUrl: '',
		}),
		validate: (form, isCreate) =>
			validateAll(
				[(currentForm) => requiredName(currentForm), (currentForm) => requiredPrice(currentForm), (currentForm, createMode) => requiredImageOnCreate(currentForm, createMode)],
				form,
				isCreate,
			),
		buildPayload: (form, isCreate) => {
			const base = buildBasePayload(form);
			return isCreate ? base : { ...base, id: form.id };
		},
		messages: { create: 'Üdítő létrehozva.', update: 'Üdítő frissítve.', delete: 'Üdítő törölve.' },
	};
}
