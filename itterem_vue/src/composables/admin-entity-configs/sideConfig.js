import { createSide, deleteSide, updateSide } from '../../services/api.js';
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

export function createSideConfig() {
	return {
		label: 'Köret',
		tableTitle: 'Köretek Kezelése',
		addLabel: '+ Új köret',
		hasImage: true,
		bulk: { canDelete: true, supportsAvailability: true, supportsPrice: true, supportsStatus: false },
		api: { create: createSide, update: updateSide, delete: deleteSide },
		columns: [
			{ key: 'id', label: 'ID' },
			{ key: 'nev', label: 'Név', bold: true },
			{ key: 'leiras', label: 'Leírás' },
			{ key: 'ar', label: 'Ár', format: (item) => formatPrice(item.ar) },
			{ key: 'elerheto', label: 'Elérhető', type: 'available' },
		],
		formFields: [
			{ key: 'nev', label: 'Név', type: 'text' },
			{ key: 'leiras', label: 'Leírás', type: 'textarea' },
			{ key: 'elerheto', label: 'Elérhető', type: 'select', options: AVAILABLE_OPTIONS },
			{ key: 'ar', label: 'Ár (Ft)', type: 'number', min: 0, step: 1 },
		],
		mapItemToForm: (item) => ({
			id: item?.id,
			nev: String(item?.nev ?? ''),
			leiras: String(item?.leiras ?? ''),
			elerheto: normalizeAvailable(item?.elerheto) ? 1 : 0,
			ar: normalizePriceValue(item?.ar),
			kepFile: null,
			currentImageUrl: getImageSrcFromItem(item, 'kep'),
		}),
		defaultForm: () => ({
			nev: '',
			leiras: '',
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
			const base = buildBasePayload(form, { includeDescription: true });
			return isCreate ? base : { ...base, id: form.id };
		},
		messages: { create: 'Köret létrehozva.', update: 'Köret frissítve.', delete: 'Köret törölve.' },
	};
}
