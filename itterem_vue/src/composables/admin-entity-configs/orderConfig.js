import { ORDER_STATUSES, deleteOrder, updateOrderStatus } from '../../api.js';
import { requiredSelect } from '../../admin-helpers.js';
import { formatDateTime, formatOrderItems } from '../../utils.js';

export function createOrderConfig() {
	return {
		label: 'Rendelés',
		tableTitle: 'Rendelések',
		addLabel: '',
		hasImage: false,
		bulk: { canDelete: true, supportsAvailability: false, supportsPrice: false, supportsStatus: true },
		showCreate: false,
		showEdit: true,
		showDelete: true,
		api: { update: ({ id, status }) => updateOrderStatus(id, status), delete: deleteOrder },
		columns: [
			{ key: 'id', label: 'ID' },
			{ key: 'felhasznaloNev', label: 'Felhasználó', bold: true },
			{ key: 'datum', label: 'Dátum', format: (item) => formatDateTime(item?.datum) },
			{ key: 'statusz', label: 'Státusz', type: 'status' },
			{ key: '_items', label: 'Tételek', format: (item) => formatOrderItems(item) },
		],
		formFields: [
			{
				key: 'status',
				label: 'Státusz',
				type: 'select',
				options: ORDER_STATUSES.map((status) => ({ value: status, label: status })),
			},
		],
		mapItemToForm: (item) => ({
			id: item?.id,
			status: String(item?.statusz ?? ''),
		}),
		defaultForm: () => ({ status: '' }),
		validate: (form) => {
			const requiredError = requiredSelect(form, 'status', 'Státusz');
			if (requiredError) return requiredError;
			if (!ORDER_STATUSES.includes(String(form.status ?? '').trim())) {
				return `Érvénytelen státusz. Engedélyezett értékek: ${ORDER_STATUSES.join(', ')}`;
			}
			return null;
		},
		buildPayload: (form, isCreate) => ({
			...(isCreate ? {} : { id: form.id }),
			status: String(form.status ?? '').trim(),
		}),
		messages: { update: 'Rendelés státusza frissítve.', delete: 'Rendelés törölve.' },
	};
}
