export function usePromiseTimeout() {
	function withTimeout(promise, ms, message = 'A művelet időtúllépés miatt megszakadt') {
		let timeoutId = null;
		const timeoutPromise = new Promise((_, reject) => {
			timeoutId = window.setTimeout(() => {
				reject(new Error(message));
			}, ms);
		});

		return Promise.race([promise, timeoutPromise]).finally(() => {
			if (timeoutId != null) window.clearTimeout(timeoutId);
		});
	}

	return { withTimeout };
}
