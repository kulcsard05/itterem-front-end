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

export const AUTH_STORAGE_KEY = 'auth';
export const AUTH_EXPIRED_EVENT = 'itterem:auth-expired';
export const AUTH_EXPIRED_MESSAGE = 'A bejelentkezés lejárt. Kérjük, jelentkezz be újra.';

/**
 * Return JWT expiration as epoch milliseconds, or null when unavailable.
 * @param {string} token
 * @returns {number|null}
 */
export function getJwtExpirationMs(token) {
	const payload = parseJwt(token);
	const exp = Number(payload?.exp);
	if (!Number.isFinite(exp) || exp <= 0) return null;
	return exp * 1000;
}

/**
 * Check whether a JWT is expired.
 * @param {string} token
 * @returns {boolean}
 */
export function isJwtExpired(token) {
	const expiryMs = getJwtExpirationMs(token);
	if (expiryMs == null) return false;
	return Date.now() >= expiryMs;
}

/**
 * Read auth object from localStorage and optionally purge expired token.
 * @param {{purgeExpired?: boolean, emitEventOnExpiry?: boolean}} [options]
 */
export function readStoredAuth(options = {}) {
	const { purgeExpired = true, emitEventOnExpiry = true } = options;

	try {
		const raw = localStorage.getItem(AUTH_STORAGE_KEY);
		const auth = raw ? JSON.parse(raw) : null;

		if (!auth?.token) return auth ?? null;

		if (purgeExpired && isJwtExpired(auth.token)) {
			clearStoredAuth({ emitEvent: emitEventOnExpiry, reason: 'expired' });
			return null;
		}

		return auth;
	} catch {
		return null;
	}
}

/**
 * Remove auth from localStorage and optionally emit an expiry event.
 * @param {{emitEvent?: boolean, reason?: string}} [options]
 */
export function clearStoredAuth(options = {}) {
	const { emitEvent = false, reason = 'logout' } = options;
	try {
		localStorage.removeItem(AUTH_STORAGE_KEY);
	} catch {
		// ignore
	}

	if (!emitEvent) return;

	try {
		window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { reason } }));
	} catch {
		// ignore
	}
}

/**
 * Find an item in a list by matching its `id`.
 * @param {Array} list
 * @param {*} idValue
 * @returns {Object|null}
 */
export function findById(list, idValue) {
	const normalizedId = String(idValue ?? '').trim();
	if (!normalizedId) return null;
	return (
		(Array.isArray(list) ? list : []).find((item) => String(item?.id ?? '').trim() === normalizedId) ?? null
	);
}

/**
 * Convenience: get display name (default `nev`) by id.
 * @param {Array} list
 * @param {*} idValue
 * @param {string} [nameKey='nev']
 * @returns {string}
 */
export function getEntityNameById(list, idValue, nameKey = 'nev') {
	const item = findById(list, idValue);
	return String(item?.[nameKey] ?? '-');
}

// ---------------------------------------------------------------------------
// Item type helpers (UI labels + order payload mapping)
// ---------------------------------------------------------------------------

const ITEM_TYPE_INFO = {
	meals: { label: 'Készétel', idKey: 'keszetelId' },
	meal: { label: 'Készétel', idKey: 'keszetelId' },
	sides: { label: 'Köret', idKey: 'koretId' },
	side: { label: 'Köret', idKey: 'koretId' },
	menus: { label: 'Menü', idKey: 'menuId' },
	menu: { label: 'Menü', idKey: 'menuId' },
	drinks: { label: 'Üdítő', idKey: 'uditoId' },
	drink: { label: 'Üdítő', idKey: 'uditoId' },
};

function normalizeItemType(type) {
	return String(type ?? '').trim().toLowerCase();
}

/**
 * Return the Hungarian label for an internal item type.
 * @param {string} type
 */
export function getItemTypeLabel(type) {
	const key = normalizeItemType(type);
	return ITEM_TYPE_INFO[key]?.label ?? 'Tétel';
}

/**
 * Return the expected id key for the ordering API payload.
 * @param {string} type
 */
export function getOrderItemIdKey(type) {
	const key = normalizeItemType(type);
	return ITEM_TYPE_INFO[key]?.idKey ?? null;
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
// Order status helpers
// ---------------------------------------------------------------------------

export const ORDER_STATUS_CLASSES = {
	Függőben: 'bg-orange-100 text-orange-800',
	Folyamatban: 'bg-yellow-100 text-yellow-800',
	Átvehető: 'bg-green-100 text-green-800 status-atvehetö',
	Átvett: 'bg-blue-100 text-blue-800',
};

export function getOrderStatusClasses(status) {
	return ORDER_STATUS_CLASSES[String(status ?? '').trim()] ?? 'bg-gray-100 text-gray-800';
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format a value as a localized date+time string (Hungarian by default).
 * Accepts Date, ISO string, or any value convertible by Date().
 */
export function formatDateTime(value, locale = 'hu-HU') {
	if (!value) return '-';
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return String(value);
	return d.toLocaleString(locale);
}

// ---------------------------------------------------------------------------
// Order display helpers
// ---------------------------------------------------------------------------

export function getOrderItemName(entry) {
	const mealName = String(entry?.keszetelNev ?? '').trim();
	if (mealName) return mealName;

	const drinkName = String(entry?.uditoNev ?? '').trim();
	if (drinkName) return drinkName;

	const menuName = String(entry?.menuNev ?? '').trim();
	if (menuName) return menuName;

	const sideName = String(entry?.koretNev ?? '').trim();
	if (sideName) return sideName;

	return 'Ismeretlen tétel';
}

export function formatOrderItems(order) {
	const list = Array.isArray(order?.rendelesElemeks) ? order.rendelesElemeks : [];
	if (list.length === 0) return '-';

	return list.map((entry) => `${getOrderItemName(entry)} × ${entry?.mennyiseg ?? 0}`).join(' | ');
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
