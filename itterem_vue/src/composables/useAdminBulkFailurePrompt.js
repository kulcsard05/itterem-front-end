import { ref } from 'vue';

export function useAdminBulkFailurePrompt({ formatEntityItemLabel }) {
	const showBulkFailureModal = ref(false);
	const bulkFailureError = ref('');
	const bulkFailureMessage = ref('');
	let bulkFailureResolver = null;

	function clearBulkFailurePrompt() {
		showBulkFailureModal.value = false;
		bulkFailureError.value = '';
		bulkFailureMessage.value = '';
		bulkFailureResolver = null;
	}

	function confirmBulkFailureContinue() {
		const resolve = bulkFailureResolver;
		clearBulkFailurePrompt();
		resolve?.(true);
	}

	function cancelBulkFailureContinue() {
		const resolve = bulkFailureResolver;
		clearBulkFailurePrompt();
		resolve?.(false);
	}

	function promptBulkFailure(error, item, remainingCount) {
		const message = error instanceof Error ? error.message : 'A művelet sikertelen.';
		bulkFailureError.value = message;
		bulkFailureMessage.value = `${formatEntityItemLabel(item)} elem feldolgozása sikertelen. ${remainingCount > 0 ? `Még ${remainingCount} elem van hátra.` : 'Nincs több hátralévő elem.'}`;
		showBulkFailureModal.value = true;
		return new Promise((resolve) => {
			bulkFailureResolver = resolve;
		});
	}

	return {
		showBulkFailureModal,
		bulkFailureError,
		bulkFailureMessage,
		clearBulkFailurePrompt,
		confirmBulkFailureContinue,
		cancelBulkFailureContinue,
		promptBulkFailure,
	};
}
