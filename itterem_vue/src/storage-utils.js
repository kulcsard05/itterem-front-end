// ---------------------------------------------------------------------------
// Shared localStorage helpers – quota-exceeded warnings, etc.
// ---------------------------------------------------------------------------

/**
 * Log a warning in DEV when a localStorage write fails due to quota.
 * In production, silently ignore the error.
 *
 * @param {string} context   A short label identifying the caller (e.g. '[Cart]').
 * @param {unknown} error    The caught error object.
 */
export function warnQuotaExceeded(context, error) {
	if (!import.meta.env.DEV) return;

	const isQuota =
		error instanceof DOMException &&
		(error.name === 'QuotaExceededError' || error.code === 22);

	if (isQuota) {
		console.warn(
			`${context} localStorage quota exceeded! Consider clearing unused keys or reducing stored data.`,
			error,
		);
	} else {
		console.warn(`${context} localStorage write failed.`, error);
	}
}

/**
 * Log a summary of all localStorage keys and their sizes (DEV only).
 * Useful for debugging what's consuming quota.
 */
export function logStorageUsage() {
	if (!import.meta.env.DEV) return;

	let total = 0;
	const entries = [];
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		const value = localStorage.getItem(key) ?? '';
		const size = key.length + value.length; // chars ≈ bytes for ASCII/Latin
		total += size;
		entries.push({ key, size });
	}
	entries.sort((a, b) => b.size - a.size);

	console.groupCollapsed(`[Storage] localStorage usage: ~${(total / 1024).toFixed(1)} KB`);
	for (const { key, size } of entries) {
		console.log(`  ${key}: ~${(size / 1024).toFixed(1)} KB`);
	}
	console.groupEnd();
}
