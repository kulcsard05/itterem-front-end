import { ORDER_STATUSES } from '../constants.js';
import {
	applyBulkPriceAdjustment,
	parseBulkAdjustmentValue,
} from '../admin-helpers.js';
import { hasValidEntityId } from '../utils.js';

export function useAdminBulkActionEngine({ entityConfigs, bulkForm, promptBulkFailure }) {
	function createDefaultBulkForm(entityType) {
		const bulk = entityConfigs[entityType]?.bulk ?? {};
		return {
			actionType: bulk.supportsStatus
				? 'status'
				: bulk.supportsAvailability
					? 'availability'
					: bulk.supportsPrice
						? 'increase-amount'
						: '',
			status: ORDER_STATUSES[0] ?? '',
			availability: '1',
			priceValue: '',
		};
	}

	function validateBulkForm() {
		const actionType = String(bulkForm.value?.actionType ?? '').trim();
		if (!actionType) return 'Válassz tömeges műveletet.';
		if (actionType === 'status') {
			const status = String(bulkForm.value?.status ?? '').trim();
			if (!ORDER_STATUSES.includes(status)) return 'Érvényes státusz kötelező.';
			return null;
		}
		if (actionType === 'availability') {
			if (!['0', '1'].includes(String(bulkForm.value?.availability ?? ''))) {
				return 'Érvényes elérhetőségi érték kötelező.';
			}
			return null;
		}
		if (parseBulkAdjustmentValue(bulkForm.value?.priceValue) === null) {
			return 'Adj meg 0-nál nagyobb árváltozást.';
		}
		return null;
	}

	async function buildBulkUpdatePayload(entityType, item, actionType) {
		const config = entityConfigs[entityType];
		if (!config) throw new Error('Ismeretlen típus.');
		if (!hasValidEntityId(item?.id)) throw new Error('Érvénytelen azonosító.');

		const resolvedItem = config.bulk?.resolveItemForUpdate
			? await config.bulk.resolveItemForUpdate(item)
			: item;
		const form = config.mapItemToForm(resolvedItem);

		if (actionType === 'status') {
			form.status = String(bulkForm.value.status ?? '').trim();
		} else if (actionType === 'availability') {
			form.elerheto = String(bulkForm.value.availability ?? '0') === '1' ? 1 : 0;
		} else {
			const nextPrice = applyBulkPriceAdjustment(resolvedItem?.ar ?? form.ar, {
				mode: actionType,
				value: bulkForm.value.priceValue,
			});
			if (nextPrice === null) throw new Error('Az új ár nem számolható ki.');
			form.ar = String(nextPrice);
		}

		const validationError = config.validate(form, false);
		if (validationError) throw new Error(validationError);
		return config.buildPayload(form, false);
	}

	async function runBulkQueue(items, executor) {
		let successCount = 0;
		let failureCount = 0;
		let stopped = false;

		for (let index = 0; index < items.length; index += 1) {
			const item = items[index];
			try {
				await executor(item);
				successCount += 1;
			} catch (error) {
				failureCount += 1;
				const shouldContinue = await promptBulkFailure(error, item, items.length - index - 1);
				if (!shouldContinue) {
					stopped = true;
					break;
				}
			}
		}

		return { successCount, failureCount, stopped };
	}

	function createBulkFeedback(config, successCount, failureCount, stopped) {
		return {
			success: successCount > 0
				? `${config.label} tömeges művelet kész: ${successCount} sikeres.`
				: '',
			error: failureCount > 0 || stopped
				? `${config.label} tömeges művelet: ${failureCount} sikertelen${stopped ? ', a folyamat leállt a kérésedre.' : '.'}`
				: '',
		};
	}

	return {
		createDefaultBulkForm,
		validateBulkForm,
		buildBulkUpdatePayload,
		runBulkQueue,
		createBulkFeedback,
	};
}
