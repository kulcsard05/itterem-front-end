import {
	AUTH_STORAGE_KEY,
	AUTH_EXPIRED_EVENT,
	AUTH_EXPIRED_MESSAGE,
	ORDER_STATUS_CLASSES as _ORDER_STATUS_CLASSES,
	ROLE_USER,
	ROLE_EMPLOYEE,
	ROLE_ADMIN,
} from './constants.js';
import { i18n, getIntlLocale } from './i18n.js';

// Re-export constants so existing imports from utils.js keep working.
export { AUTH_STORAGE_KEY, AUTH_EXPIRED_EVENT, AUTH_EXPIRED_MESSAGE };

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function stripTrailingSlashes(value) {
	return String(value ?? '').replace(/\/+$/, '');
}

/**
 * Return the API base URL.
 * In development, the browser always uses same-origin requests so Vite's
 * proxy remains the single integration point for the backend.
 * In non-dev builds, VITE_API_BASE_URL must be set explicitly.
 * @returns {string}
 */
export function getApiBaseUrl() {
	if (import.meta.env.DEV) return '';

	const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
	if (envBaseUrl === undefined) {
		console.warn('[Itterem] VITE_API_BASE_URL is not set – configure it in .env');
		return '';
	}

	return stripTrailingSlashes(envBaseUrl);
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
	return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(String(value ?? '').trim());
}

/**
 * Validate a phone number (at least 7 digits, allows +, (), -, spaces, dots).
 * @param {string} value
 * @returns {boolean}
 */
export function isValidPhone(value) {
	const raw = String(value ?? '').trim();
	if (!raw || !/^[0-9+()\-\s.]+$/.test(raw)) return false;
	return raw.replace(/\D/g, '').length >= 7;
}

/**
 * Return a plain object fallback for non-object values.
 * @param {*} value
 * @returns {Object}
 */
export function asObject(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return value;
}

/**
 * Return an array fallback for non-array values.
 * @param {*} value
 * @returns {Array}
 */
export function asArray(value) {
	return Array.isArray(value) ? value : [];
}

/**
 * Normalize an id-like value to a trimmed string key.
 * @param {*} value
 * @returns {string}
 */
export function normalizeId(value) {
	return String(value ?? '').trim();
}

/**
 * Resolve dynamic form field options with defensive fallbacks.
 * @param {Array} fields
 * @returns {Object<string, Array>}
 */
export function buildFieldOptionsMap(fields = []) {
	const map = {};
	for (const field of asArray(fields)) {
		if (!field || typeof field !== 'object') continue;
		if (field.type !== 'select' && field.type !== 'multiselect') continue;
		try {
			const resolved = typeof field.options === 'function' ? field.options() : field.options;
			map[field.key] = asArray(resolved);
		} catch {
			map[field.key] = [];
		}
	}
	return map;
}

/**
 * Read resolved options for a field key from an options map.
 * @param {Object} optionsMap
 * @param {string} fieldKey
 * @returns {Array}
 */
export function getFieldOptions(optionsMap, fieldKey) {
	return asArray(asObject(optionsMap)?.[fieldKey]);
}

/**
 * Check whether a value looks like an auth payload returned by the backend.
 * @param {*} value
 * @param {{requireToken?: boolean, requireRole?: boolean}} [options]
 * @returns {boolean}
 */
export function isAuthPayload(value, options = {}) {
	const { requireToken = false, requireRole = false } = options;
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

	if (requireToken && !String(value.token ?? '').trim()) return false;

	const normalizedRole = String(value.jogosultsag ?? '').trim();
	if (!normalizedRole) return !requireRole;

	const roleNumber = Number(normalizedRole);
	return [ROLE_USER, ROLE_EMPLOYEE, ROLE_ADMIN].includes(roleNumber);
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
		const raw = String(token ?? '').trim();
		if (!raw) return null;

		const parts = raw.split('.');
		if (parts.length < 2) return null;

		const json = decodeBase64Url(parts[1]);
		return JSON.parse(json);
	} catch {
		return null;
	}
}

// AUTH_STORAGE_KEY, AUTH_EXPIRED_EVENT, AUTH_EXPIRED_MESSAGE are imported
// from constants.js and re-exported at the top of this file.

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

		if (!isAuthPayload(auth)) return null;

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
	const items = asArray(list);
	return items.find((item) => String(item?.id ?? '').trim() === normalizedId) ?? null;
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

/**
 * Resolve user ID from auth object, handling multiple possible field names.
 * @param {Object} auth
 * @returns {*}
 */
export function resolveUserId(auth) {
	const decodedToken = parseJwt(auth?.token);
	return decodedToken?.sub ?? null;
}

// ---------------------------------------------------------------------------
// Item type helpers (UI labels + order payload mapping)
// ---------------------------------------------------------------------------

const ITEM_TYPE_INFO = {
	meals: { labelKey: 'itemTypes.meal', idKey: 'keszetelId' },
	meal: { labelKey: 'itemTypes.meal', idKey: 'keszetelId' },
	sides: { labelKey: 'itemTypes.side', idKey: 'koretId' },
	side: { labelKey: 'itemTypes.side', idKey: 'koretId' },
	menus: { labelKey: 'itemTypes.menu', idKey: 'menuId' },
	menu: { labelKey: 'itemTypes.menu', idKey: 'menuId' },
	drinks: { labelKey: 'itemTypes.drink', idKey: 'uditoId' },
	drink: { labelKey: 'itemTypes.drink', idKey: 'uditoId' },
};

const ORDER_STATUS_LABELS = {
	'Függőben': 'orderStatuses.pending',
	'Folyamatban': 'orderStatuses.processing',
	'Átvehető': 'orderStatuses.ready',
	'Átvett': 'orderStatuses.done',
};

function translate(key, values = {}) {
	return i18n.global.t(key, values);
}

function normalizeItemType(type) {
	return String(type ?? '').trim().toLowerCase();
}

/**
 * Return the Hungarian label for an internal item type.
 * @param {string} type
 */
export function getItemTypeLabel(type) {
	const key = normalizeItemType(type);
	return translate(ITEM_TYPE_INFO[key]?.labelKey ?? 'itemTypes.item');
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

/**
 * Parse an integer and return null for invalid or non-positive values.
 * @param {*} value
 * @returns {number|null}
 */
export function toPositiveIntOrNull(value) {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) return null;
	return parsed;
}

/**
 * Parse and clamp an integer to a positive range.
 * Returns fallback when the input is invalid.
 * @param {*} value
 * @param {{min?: number, max?: number, fallback?: number}} [options]
 * @returns {number}
 */
export function toBoundedPositiveInt(value, options = {}) {
	const { min = 1, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = options;
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	const whole = Math.trunc(parsed);
	if (whole < min) return fallback;
	if (whole > max) return max;
	return whole;
}

/**
 * Check whether a value is a valid positive entity id.
 * @param {*} value
 * @returns {boolean}
 */
export function hasValidEntityId(value) {
	return toPositiveIntOrNull(value) != null;
}

// ---------------------------------------------------------------------------
// Order status helpers
// ---------------------------------------------------------------------------

export const ORDER_STATUS_CLASSES = _ORDER_STATUS_CLASSES;

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
	const targetLocale = locale === 'hu-HU' ? getIntlLocale(i18n.global.locale.value) : locale;
	return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString(targetLocale);
}

export function formatCurrency(value, locale = i18n.global.locale.value) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return translate('common.notAvailable');
	try {
		return new Intl.NumberFormat(getIntlLocale(locale), {
			style: 'currency',
			currency: 'HUF',
			maximumFractionDigits: 0,
		}).format(parsed);
	} catch {
		return translate('common.currency.fallback', { value: parsed });
	}
}

export function getOrderStatusLabel(status) {
	return translate(ORDER_STATUS_LABELS[String(status ?? '').trim()] ?? 'common.notAvailable');
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

	return translate('itemTypes.item');
}

export function formatOrderItems(order) {
	const list = asArray(order?.rendelesElemeks);
	if (list.length === 0) return '-';

	return list.map((entry) => `${getOrderItemName(entry)} × ${entry?.mennyiseg ?? 0}`).join(' | ');
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared entity helpers (deduplicated from components)
// ---------------------------------------------------------------------------

/**
 * Extract ingredient names from a meal object.
 * Backend shape uses `hozzavaloNev` on each ingredient.
 * @param {Object} meal
 * @returns {string[]}
 */
export function getMealIngredientNames(meal) {
	const list = asArray(meal?.hozzavalok);
	return list
		.map((h) => String(h?.hozzavaloNev ?? '').trim())
		.filter(Boolean);
}

/**
 * Extract the category ID from a meal, normalised to string or null.
 * @param {Object} meal
 * @returns {string|null}
 */
export function getMealCategoryId(meal) {
	const value = meal?.kategoriaId ?? null;
	return value == null ? null : String(value);
}

/**
 * Sort orders descending by date (newest first).
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
export function sortOrdersByDateDesc(a, b) {
	const ta = new Date(a?.datum ?? 0).getTime();
	const tb = new Date(b?.datum ?? 0).getTime();
	return tb - ta;
}

// ---------------------------------------------------------------------------
// Images (continued)
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
