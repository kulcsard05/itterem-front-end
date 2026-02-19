import { getApiBaseUrl, getListCacheKey } from './api.js';

/**
 * Validate an email address.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidEmail(value) {
	const v = String(value || '').trim();
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * Validate a phone number (at least 7 digits, allows +, (), -, spaces, dots).
 * @param {string} value
 * @returns {boolean}
 */
export function isValidPhone(value) {
	const raw = String(value || '').trim();
	if (!raw) return false;
	if (!/^[0-9+()\-\s.]+$/.test(raw)) return false;
	const digits = raw.replace(/\D/g, '');
	return digits.length >= 7;
}

/**
 * Find an item in a list by matching its `id` or `nev` field.
 * @param {Array} list
 * @param {*} idValue
 * @param {*} nameValue
 * @returns {Object|null}
 */
export function findByIdOrName(list, idValue, nameValue) {
	const normalizedId = String(idValue ?? '').trim();
	const normalizedName = String(nameValue ?? '')
		.trim()
		.toLowerCase();

	return (
		(Array.isArray(list) ? list : []).find((item) => {
			const itemId = String(item?.id ?? '').trim();
			const itemName = String(item?.nev ?? '')
				.trim()
				.toLowerCase();

			if (normalizedId && itemId && itemId === normalizedId) return true;
			if (normalizedName && itemName && itemName === normalizedName) return true;
			return false;
		}) ?? null
	);
}

/**
 * Read a cached entity list from localStorage (written by api.js).
 * @param {string} endpointPath  e.g. '/api/Keszetelek'
 * @returns {Array}
 */
export function readCachedList(endpointPath) {
	try {
		const key = getListCacheKey(endpointPath);
		const raw = localStorage.getItem(key);
		if (!raw) return [];

		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) return parsed;
		if (parsed && Array.isArray(parsed.data)) return parsed.data;
		return [];
	} catch {
		return [];
	}
}

/**
 * Return the first non-empty trimmed string from a list of candidates.
 * @param {Array<string|null|undefined>} candidates
 * @returns {string}
 */
export function readFirstText(candidates = []) {
	for (const candidate of candidates) {
		const value = String(candidate ?? '').trim();
		if (value) return value;
	}
	return '';
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

function looksLikeBase64Binary(value) {
	const s = String(value ?? '').trim();
	if (s.length < 40 || /[\s]/.test(s)) return false;
	return /^[A-Za-z0-9+/=]+$/.test(s);
}

/**
 * Convert various backend "image" representations into a browser-safe <img src>.
 * Handles:
 * - absolute URLs
 * - relative paths (prefixed with API base URL)
 * - base64 (assumed jpeg)
 * - already-usable data:/blob:
 */
export function toImageSrc(rawValue, { baseUrl } = {}) {
	const value = String(rawValue ?? '').trim();
	if (!value) return '';

	if (value.startsWith('data:') || value.startsWith('blob:')) return value;
	if (/^https?:\/\//i.test(value)) return value;
	if (looksLikeBase64Binary(value)) return `data:image/jpeg;base64,${value}`;

	const base = String(baseUrl ?? getApiBaseUrl() ?? '').trim();
	const path = value.startsWith('/') ? value : `/${value}`;
	return base ? `${base}${path}` : path;
}

/**
 * Convenience for entities that store an image under the `kep` field.
 */
export function getImageSrcFromItem(item, key = 'kep') {
	if (!item || typeof item !== 'object') return '';
	return toImageSrc(item?.[key]);
}
