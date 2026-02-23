// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_API_BASE_URL = 'https://localhost:7200';

function stripTrailingSlashes(value) {
	return String(value || '').replace(/\/+$/, '');
}

/**
 * Return the API base URL from environment or fallback to default.
 * @returns {string}
 */
export function getApiBaseUrl() {
	const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
	if (envBaseUrl !== undefined) return stripTrailingSlashes(envBaseUrl);
	return stripTrailingSlashes(DEFAULT_API_BASE_URL);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

function decodeBase64Url(value) {
	const normalized = String(value || '')
		.replace(/-/g, '+')
		.replace(/_/g, '/');

	const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
	const binary = atob(padded);

	if (typeof TextDecoder !== 'undefined') {
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
		return new TextDecoder('utf-8').decode(bytes);
	}

	// Fallback for environments without TextDecoder.
	try {
		// eslint-disable-next-line no-undef
		return decodeURIComponent(
			binary
				.split('')
				.map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
				.join(''),
		);
	} catch {
		return binary;
	}
}

/**
 * Decode the payload of a JWT (no signature verification).
 * @param {string} token
 * @returns {object|null}
 */
export function parseJwt(token) {
	try {
		const raw = String(token || '').trim();
		if (!raw) return null;

		const parts = raw.split('.');
		if (parts.length < 2) return null;

		const json = decodeBase64Url(parts[1]);
		return JSON.parse(json);
	} catch {
		return null;
	}
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

// ---------------------------------------------------------------------------
// List cache (localStorage)
// ---------------------------------------------------------------------------

const LIST_CACHE_PREFIX = 'itterem:list:';

/**
 * Build the localStorage key for a given endpoint path.
 * @param {string} endpointPath
 * @returns {string}
 */
export function getListCacheKey(endpointPath) {
	return `${LIST_CACHE_PREFIX}${String(endpointPath || '')
		.trim()
		.toLowerCase()}`;
}

/**
 * Write an entity list to localStorage cache.
 * @param {string} endpointPath
 * @param {Array} list
 */
export function writeListCache(endpointPath, list) {
	try {
		const key = getListCacheKey(endpointPath);
		localStorage.setItem(key, JSON.stringify(Array.isArray(list) ? list : []));
	} catch {
		// Ignore cache write errors.
	}
}

/**
 * Read a cached entity list from localStorage.
 * @param {string} endpointPath  e.g. '/api/Keszetelek'
 * @returns {Array}
 */
export function readListCache(endpointPath) {
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
