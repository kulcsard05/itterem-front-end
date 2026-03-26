import {
	AUTH_EXPIRED_MESSAGE,
	clearStoredAuth,
	getApiBaseUrl,
	isAuthPayload,
	notifyPermissionDenied,
	readStoredAuth,
	asArray,
	toPositiveIntOrNull,
} from '../shared/utils.js';
import { readOrderCreateId, readOrderMessage } from '../domain/order/order-utils.js';
import { i18n } from '../i18n.js';
import { deleteMenuEtag, readMenuEtags, writeMenuEtag } from '../storage/menu-etags.js';

// ---------------------------------------------------------------------------
// Fetch with timeout — prevents requests from hanging indefinitely.
// ---------------------------------------------------------------------------

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
const NETWORK_ERROR_MESSAGE = 'Hálózati hiba – ellenőrizd az internetkapcsolatot';
const HELPER_HOST = import.meta.env.VITE_DISCOVERY_HELPER_HOST || '127.0.0.1';
const HELPER_PORT = Number(import.meta.env.VITE_DISCOVERY_HELPER_PORT || 41721);
const HELPER_BASE_URL = `http://${HELPER_HOST}:${HELPER_PORT}`;
const DISCOVERY_RESULT_POLL_MS = 500;
const DISCOVERY_TIMEOUT_MS = 10_000;
const DISCOVERY_TRIGGER = 'preview-api-recovery';

let discoveryRecoveryPromise = null;

function normalizeBaseUrl(url) {
	return String(url ?? '').trim().replace(/\/+$/, '');
}

function isRuntimeDiscoveryEnabled() {
	// Preview (and other non-dev static builds) can recover via helper.
	return !import.meta.env.DEV;
}

function persistDiscoveredServerUrl(url) {
	const cleaned = normalizeBaseUrl(url);
	if (!cleaned) return '';
	try {
		localStorage.setItem(SERVER_URL_STORAGE_KEY, cleaned);
	} catch {
		// ignore storage failures
	}
	return cleaned;
}

function helperUrl(path) {
	return `${HELPER_BASE_URL}${path}`;
}

async function helperFetchJson(path, options = {}) {
	const response = await fetch(helperUrl(path), options);
	const text = await response.text();
	let body = null;
	if (text) {
		try {
			body = JSON.parse(text);
		} catch {
			body = { raw: text };
		}
	}

	if (!response.ok) {
		const message = body?.error || body?.message || `HTTP ${response.status}`;
		throw new Error(message);
	}

	return body;
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function discoverBackendForRecovery() {
	if (!isRuntimeDiscoveryEnabled()) return '';
	if (discoveryRecoveryPromise) return discoveryRecoveryPromise;

	discoveryRecoveryPromise = (async () => {
		try {
			await helperFetchJson('/discover', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ trigger: DISCOVERY_TRIGGER }),
			});

			const deadline = Date.now() + DISCOVERY_TIMEOUT_MS;
			while (Date.now() < deadline) {
				const snapshot = await helperFetchJson('/result');
				if (snapshot?.status === 'found' && snapshot?.result?.baseUrl) {
					return persistDiscoveredServerUrl(snapshot.result.baseUrl);
				}
				if (snapshot?.status === 'error') {
					return '';
				}
				await sleep(DISCOVERY_RESULT_POLL_MS);
			}
		} catch {
			// Helper unavailable or discovery failed; fall back to original error path.
		}

		return '';
	})().finally(() => {
		discoveryRecoveryPromise = null;
	});

	return discoveryRecoveryPromise;
}

function rewriteUrlWithBase(url, nextBase) {
	const base = normalizeBaseUrl(nextBase);
	if (!base) return null;

	const rawUrl = String(url ?? '');
	if (!rawUrl) return null;

	if (rawUrl.startsWith('/')) {
		return `${base}${rawUrl}`;
	}

	try {
		const parsed = new URL(rawUrl);
		return `${base}${parsed.pathname}${parsed.search}${parsed.hash}`;
	} catch {
		return null;
	}
}

async function abortableFetch(url, options = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, allowRecoveryRetry = true) {
	if (!timeoutMs || timeoutMs <= 0) return fetch(url, options);

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		return await fetch(url, { ...options, signal: controller.signal });
	} catch (err) {
		if (err.name === 'AbortError') {
			throw new Error(i18n.global.t('api.errors.timeout'));
		}

		if (allowRecoveryRetry && isRuntimeDiscoveryEnabled()) {
			const discoveredBase = await discoverBackendForRecovery();
			const retryUrl = rewriteUrlWithBase(url, discoveredBase);
			if (retryUrl && retryUrl !== String(url ?? '')) {
				return abortableFetch(retryUrl, options, timeoutMs, false);
			}
		}

		throw err;
	} finally {
		clearTimeout(timer);
	}
}

// ---------------------------------------------------------------------------
// Centralized 401 handler
// ---------------------------------------------------------------------------

function handleAuthFailure() {
	clearStoredAuth({ emitEvent: true, reason: 'unauthorized' });
	throw new Error(AUTH_EXPIRED_MESSAGE);
}

function createHttpError(message, options = {}) {
	const { status = null, code = '' } = options;
	const resolvedMessage = String(message ?? '').trim() || 'Request failed';
	const error = new Error(resolvedMessage);
	if (Number.isFinite(Number(status))) error.status = Number(status);
	if (code) error.code = code;
	if (Number(status) === 403) error.isPermissionDenied = true;
	return error;
}

function handlePermissionDenied(body, fallbackErrorMessage, context = {}) {
	const fallbackMessage = String(fallbackErrorMessage ?? '').trim()
		|| String(i18n.global.t('errors.permissionDeniedAction')).trim();
	const message = extractErrorMessage(body, fallbackMessage);
	const resolvedMessage = notifyPermissionDenied({
		message,
		messageKey: 'errors.permissionDeniedAction',
		source: 'api',
		status: 403,
		...context,
	});
	throw createHttpError(resolvedMessage, { status: 403, code: 'forbidden' });
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Read the JWT token from localStorage.
 * @returns {string|null}
 */
function getAuthToken() {
	const auth = readStoredAuth();
	return auth?.token ?? null;
}

/**
 * Build request headers with optional JWT Authorization.
 * @param {Object} [extra]  Additional headers to merge.
 * @returns {Object}
 */
function authHeaders(extra = {}) {
	const headers = { accept: '*/*', ...extra };
	const token = getAuthToken();
	if (token) headers['Authorization'] = `Bearer ${token}`;
	return headers;
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

async function readJsonOrText(response) {
	const contentType = response.headers.get('content-type') || '';
	const raw = await response.text();

	if (!raw) return '';
	const trimmed = raw.trim();

	const looksJson =
		contentType.includes('application/json') ||
		/^[\[{"]/.test(trimmed);

	if (looksJson) {
		try {
			return JSON.parse(raw);
		} catch {
			return raw;
		}
	}

	return raw;
}

function extractErrorMessage(body, fallbackErrorMessage) {
	if (typeof body === 'string') {
		const text = body.trim();
		if (text) return text;
		return fallbackErrorMessage;
	}

	if (body && typeof body === 'object') {
		const messageFields = ['message', 'error', 'detail', 'title'];
		for (const field of messageFields) {
			const value = String(body?.[field] ?? '').trim();
			if (value) return value;
		}
	}

	return fallbackErrorMessage;
}

async function requestJsonOrThrow(response, fallbackErrorMessage, context = {}) {
	const body = await readJsonOrText(response);
	if (response.ok) return body;

	if (response.status === 401) handleAuthFailure();
	if (response.status === 403) {
		handlePermissionDenied(body, fallbackErrorMessage, context);
	}

	const message = extractErrorMessage(body, fallbackErrorMessage);
	throw new Error(message || fallbackErrorMessage);
}

function throwKnownOrFallback(error, fallbackMessage) {
	if (error instanceof Error) throw error;
	throw new Error(fallbackMessage);
}

// ---------------------------------------------------------------------------
// Generic CRUD helpers
// ---------------------------------------------------------------------------

/**
 * Generic mutation helper for POST / PUT / DELETE.
 *
 * @param {Object}  opts
 * @param {'POST'|'PUT'|'DELETE'} opts.method       HTTP method.
 * @param {string}                opts.endpoint      Path appended to base URL (e.g. '/api/Hozzavalok').
 * @param {Object}               [opts.params]       Query-string key/value pairs.
 * @param {File}                  [opts.kepFile]      Optional image file to upload.
 * @param {string}                opts.fallbackError  Error message when backend doesn't provide one.
 * @returns {Promise<*>}
 */
async function mutate({ method, endpoint, params = {}, kepFile, fallbackError }) {
	const baseUrl = getApiBaseUrl();

	// Build query string.
	// Supports array values by appending repeated keys:
	// { hozzavalokIds: [1,2] } -> ?hozzavalokIds=1&hozzavalokIds=2
	const searchParams = new URLSearchParams();
	for (const [key, rawValue] of Object.entries(params ?? {})) {
		if (Array.isArray(rawValue)) {
			for (const entry of rawValue) searchParams.append(key, String(entry ?? ''));
			continue;
		}
		searchParams.set(key, String(rawValue ?? ''));
	}

	const queryString = searchParams.toString();
	const url = queryString ? `${baseUrl}${endpoint}?${queryString}` : `${baseUrl}${endpoint}`;

	// If there is a file, send as FormData; otherwise empty body for POST, none for others.
	let body = undefined;
	const headers = authHeaders();

	if (kepFile instanceof File) {
		const fd = new FormData();
		fd.append('kep', kepFile, kepFile.name || 'image');
		body = fd;
	} else if (method === 'POST') {
		body = '';
	}

	const response = await abortableFetch(url, {
		method,
		headers,
		body,
	});

	return requestJsonOrThrow(response, fallbackError, { endpoint, method });
}

async function getById(endpoint, id, fallbackError) {
	const baseUrl = getApiBaseUrl();
	const url = `${baseUrl}${endpoint}/${encodeURIComponent(String(id ?? ''))}`;
	const response = await abortableFetch(url, { method: 'GET', headers: authHeaders() });
	return requestJsonOrThrow(response, fallbackError, { endpoint, method: 'GET' });
}

/**
 * DELETE where the id is part of the URL path (e.g. /api/Hozzavalok/5).
 * Most entities use this pattern.
 */
async function deletePath(endpoint, id, fallbackError) {
	const baseUrl = getApiBaseUrl();
	const response = await abortableFetch(`${baseUrl}${endpoint}/${encodeURIComponent(String(id))}`, {
		method: 'DELETE',
		headers: authHeaders(),
	});
	return requestJsonOrThrow(response, fallbackError, { endpoint, method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function login(email, password) {
	try {
		const baseUrl = getApiBaseUrl();

		const response = await abortableFetch(`${baseUrl}/api/Login`, {
			method: 'POST',
			headers: { accept: '*/*', 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, passwd: password }),
		});

		const body = await readJsonOrText(response);

		if (response.ok) {
			if (typeof body === 'string') throw new Error(body || 'Bejelentkezés sikertelen');
			if (!isAuthPayload(body, { requireToken: true, requireRole: true })) {
				throw new Error(extractErrorMessage(body, 'Érvénytelen bejelentkezési válasz a szervertől'));
			}
			return body;
		}
		if (response.status === 401) {
			throw new Error('Hibás email vagy jelszó');
		}
		throw new Error(extractErrorMessage(body, 'Bejelentkezés sikertelen'));
	} catch (error) {
		throwKnownOrFallback(error, NETWORK_ERROR_MESSAGE);
	}
}

export async function register({ teljesNev, email, password, telefonSzam }) {
	try {
		const baseUrl = getApiBaseUrl();

		const response = await abortableFetch(`${baseUrl}/api/Registration`, {
			method: 'POST',
			headers: { accept: '*/*', 'Content-Type': 'application/json' },
			body: JSON.stringify({
				teljesNev: String(teljesNev ?? '').trim(),
				email: String(email ?? '').trim(),
				jelszo: String(password ?? ''),
				telefonszam: String(telefonSzam ?? '').trim(),
			}),
		});

		const body = await readJsonOrText(response);

		if (response.ok) return body;
		throw new Error(extractErrorMessage(body, 'Regisztráció sikertelen'));
	} catch (error) {
		throwKnownOrFallback(error, NETWORK_ERROR_MESSAGE);
	}
}

function normalizeOrderCreateResponse(payload) {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		throw new Error('Érvénytelen rendelés-válasz a szervertől');
	}

	const orderId = toPositiveIntOrNull(readOrderCreateId(payload));
	const message = String(readOrderMessage(payload) ?? '').trim();

	if (orderId == null && !message) {
		throw new Error('Érvénytelen rendelés-válasz a szervertől');
	}

	return {
		...payload,
		orderId,
		message,
	};
}

function normalizeOrderItems(orderItems) {
	const source = asArray(orderItems);
	const normalized = [];
	for (const rawItem of source) {
		if (!rawItem || typeof rawItem !== 'object') continue;

		const quantity = Number(rawItem.mennyiseg);
		if (!Number.isInteger(quantity) || quantity <= 0) continue;

		const item = { mennyiseg: quantity };
		if (toPositiveIntOrNull(rawItem.keszetelId) != null) item.keszetelId = toPositiveIntOrNull(rawItem.keszetelId);
		if (toPositiveIntOrNull(rawItem.koretId) != null) item.koretId = toPositiveIntOrNull(rawItem.koretId);
		if (toPositiveIntOrNull(rawItem.uditoId) != null) item.uditoId = toPositiveIntOrNull(rawItem.uditoId);
		if (toPositiveIntOrNull(rawItem.menuId) != null) item.menuId = toPositiveIntOrNull(rawItem.menuId);

		const idFieldCount = ['keszetelId', 'koretId', 'uditoId', 'menuId'].filter((key) => key in item).length;
		if (idFieldCount !== 1) continue;

		normalized.push(item);
	}

	if (normalized.length === 0) {
		throw new Error('A rendelés nem tartalmaz érvényes tételeket');
	}

	return normalized;
}

/**
 * Update the signed-in user's phone number.
 * PUT /api/Login?id={id}&telefonszam={phone}
 */
export function updatePhone({ id, telefonszam }) {
	return mutate({
		method: 'PUT',
		endpoint: '/api/Login',
		params: { id, telefonszam },
		fallbackError: 'Telefonszám frissítése sikertelen',
	});
}

// ---------------------------------------------------------------------------
// GET lists
// ---------------------------------------------------------------------------

async function getList(endpointPath, fallbackErrorMessage, extraArrayKeys = []) {
	const baseUrl = getApiBaseUrl();
	const url = baseUrl ? `${baseUrl}${endpointPath}` : endpointPath;

	try {
		const response = await abortableFetch(url, {
			method: 'GET',
			headers: authHeaders(),
		});

		const body = await requestJsonOrThrow(response, fallbackErrorMessage, {
			endpoint: endpointPath,
			method: 'GET',
		});

		const list = extractListFromBody(body, extraArrayKeys);
		if (list === null) {
			if (import.meta.env.DEV && endpointPath === '/api/Uditok') {
				console.warn('[API] Unexpected drinks payload shape (GET list)', body);
			}
			throw new Error(fallbackErrorMessage);
		}
		return list;
	} catch (error) {
		if (error instanceof Error && error.message === AUTH_EXPIRED_MESSAGE) {
			throw error;
		}
		throwKnownOrFallback(error, fallbackErrorMessage);
	}
}

function extractListFromBody(body, extraArrayKeys = []) {
	if (Array.isArray(body)) return body;
	if (!body || typeof body !== 'object') return [];

	for (const key of extraArrayKeys) {
		const value = body?.[key];
		if (Array.isArray(value)) return value;
	}
	// Unrecognized object shape should not silently erase cached content.
	return null;
}

/**
 * Conditional GET using ETag.
 * Returns an object so callers can skip state updates on 304.
 */
async function getListWithEtag(endpointPath, fallbackErrorMessage, extraArrayKeys = [], etagKey = '') {
	const baseUrl = getApiBaseUrl();
	const url = baseUrl ? `${baseUrl}${endpointPath}` : endpointPath;

	try {
		const headers = authHeaders({
			// Force revalidation so the request actually gives the backend a chance
			// to answer with 304 Not Modified when an ETag is already known.
			'Cache-Control': 'no-cache',
			Pragma: 'no-cache',
		});
		const knownEtag = readMenuEtags()[etagKey];
		if (knownEtag) headers['If-None-Match'] = knownEtag;

		const response = await abortableFetch(url, {
			method: 'GET',
			headers,
			cache: 'no-store',
		});

		if (response.status === 304) {
			return {
				notModified: true,
				data: null,
			};
		}

		const body = await requestJsonOrThrow(response, fallbackErrorMessage, {
			endpoint: endpointPath,
			method: 'GET',
		});

		const nextEtag = response.headers.get('etag');
		if (nextEtag) writeMenuEtag(etagKey, nextEtag);
		else deleteMenuEtag(etagKey);

		const list = extractListFromBody(body, extraArrayKeys);
		if (list === null) {
			if (import.meta.env.DEV && endpointPath === '/api/Uditok') {
				console.warn('[API] Unexpected drinks payload shape (conditional list)', body);
			}
			throw new Error(fallbackErrorMessage);
		}

		return {
			notModified: false,
			data: list,
		};
	} catch (error) {
		if (error instanceof Error && error.message === AUTH_EXPIRED_MESSAGE) {
			throw error;
		}
		throwKnownOrFallback(error, fallbackErrorMessage);
	}
}

const DATASET_CONFIG = Object.freeze({
	categories: {
		endpointPath: '/api/Kategoria',
		fallbackErrorMessage: 'Kategóriák betöltése sikertelen',
		extraArrayKeys: [],
		etagKey: 'categories',
	},
	meals: {
		endpointPath: '/api/Keszetelek',
		fallbackErrorMessage: 'Készételek betöltése sikertelen',
		extraArrayKeys: [],
		etagKey: 'meals',
	},
	sides: {
		endpointPath: '/api/Koretek',
		fallbackErrorMessage: 'Köretek betöltése sikertelen',
		extraArrayKeys: [],
		etagKey: 'sides',
	},
	menus: {
		endpointPath: '/api/Menuk',
		fallbackErrorMessage: 'Menük betöltése sikertelen',
		extraArrayKeys: [],
		etagKey: 'menus',
	},
	drinks: {
		endpointPath: '/api/Uditok',
		fallbackErrorMessage: 'Üdítők betöltése sikertelen',
		extraArrayKeys: [],
		etagKey: 'drinks',
	},
});

function getDataset(datasetKey, conditional = false) {
	const config = DATASET_CONFIG[datasetKey];
	if (!config) {
		throw new Error('Ismeretlen adatkészlet');
	}

	if (conditional) {
		return getListWithEtag(
			config.endpointPath,
			config.fallbackErrorMessage,
			config.extraArrayKeys,
			config.etagKey,
		);
	}

	return getList(
		config.endpointPath,
		config.fallbackErrorMessage,
		config.extraArrayKeys,
	);
}

export function getCategories() {
	return getDataset('categories');
}

export function getCategoriesConditional() {
	return getDataset('categories', true);
}

/** Keszetelek = Készételek */
export function getMeals() {
	return getDataset('meals');
}

export function getMealsConditional() {
	return getDataset('meals', true);
}

export function getMealById(id) {
	return getById('/api/Keszetelek', id, 'Készétel betöltése sikertelen');
}

/** Koretek = Köretek */
export function getSides() {
	return getDataset('sides');
}

export function getSidesConditional() {
	return getDataset('sides', true);
}

export function getMenus() {
	return getDataset('menus');
}

export function getMenusConditional() {
	return getDataset('menus', true);
}

export function getDrinks() {
	return getDataset('drinks');
}

export function getDrinksConditional() {
	return getDataset('drinks', true);
}

// ---------------------------------------------------------------------------
// Orders  (Rendelések)
// ---------------------------------------------------------------------------

// Re-export order statuses from config constants for API-level validation.
import { ORDER_STATUSES, SERVER_URL_STORAGE_KEY } from '../config/constants.js';
export { ORDER_STATUSES };

export function getOrders() {
	return getList('/api/Rendelesek', 'Rendelések betöltése sikertelen');
}

export function getOwnOrders() {
	return getList('/api/Rendelesek/sajat', 'Saját rendelések betöltése sikertelen');
}

export function updateOrderStatus(id, status) {
	const normalizedId = String(id ?? '').trim();
	const normalizedStatus = String(status ?? '').trim();
	if (!normalizedId) {
		throw new Error('Érvénytelen rendelés azonosító.');
	}
	if (!ORDER_STATUSES.includes(normalizedStatus)) {
		throw new Error(`Érvénytelen státusz. Engedélyezett értékek: ${ORDER_STATUSES.join(', ')}`);
	}

	const fallbackError = 'Rendelés státusz frissítése sikertelen';
	const encodedId = encodeURIComponent(normalizedId);
	const encodedStatus = encodeURIComponent(normalizedStatus);
	const baseUrl = getApiBaseUrl();

	return abortableFetch(`${baseUrl}/api/Rendelesek/${encodedId}?status=${encodedStatus}`, {
		method: 'PUT',
		headers: authHeaders(),
	}).then((response) => requestJsonOrThrow(response, fallbackError, {
		endpoint: '/api/Rendelesek/{id}',
		method: 'PUT',
	}));
}

/**
 * Place an order.
 *
 * @param {number} felhasznaloId   The logged-in user's ID.
 * @param {Array}  orderItems      Array of order line objects, e.g.
 *   [{ keszetelId: 1, mennyiseg: 1 }, { uditoId: 2, mennyiseg: 3 }, ...]
 * @returns {Promise<*>}
 */
export async function placeOrder(felhasznaloId, orderItems) {
	const normalizedUserId = toPositiveIntOrNull(felhasznaloId);
	if (normalizedUserId == null) {
		throw new Error('A felhasználó azonosító érvénytelen');
	}

	const normalizedOrderItems = normalizeOrderItems(orderItems);

	const baseUrl = getApiBaseUrl();
	const response = await abortableFetch(`${baseUrl}/api/Rendelesek`, {
		method: 'POST',
		headers: authHeaders({ 'Content-Type': 'application/json' }),
		body: JSON.stringify({ felhasznaloId: normalizedUserId, items: normalizedOrderItems }),
	});
	const body = await requestJsonOrThrow(response, 'Rendelés leadása sikertelen', {
		endpoint: '/api/Rendelesek',
		method: 'POST',
	});
	return normalizeOrderCreateResponse(body);
}

export function deleteOrder(id) {
	return mutate({
		method: 'DELETE',
		endpoint: '/api/Rendelesek',
		params: { id },
		fallbackError: 'Rendelés törlése sikertelen',
	});
}

/** Hozzavalok = Hozzávalók */
export function getIngredients() {
	return getList('/api/Hozzavalok', 'Hozzávalók betöltése sikertelen');
}

// ---------------------------------------------------------------------------
// Ingredients  (Hozzávalók)
// ---------------------------------------------------------------------------

export function updateIngredient({ id, nev }) {
	return mutate({
		method: 'PUT',
		endpoint: '/api/Hozzavalok',
		params: { id, nev },
		fallbackError: 'Hozzávaló frissítése sikertelen',
	});
}

/** DELETE uses path param: /api/Hozzavalok/{id} */
export function deleteIngredient(id) {
	return deletePath('/api/Hozzavalok', id, 'Hozzávaló törlése sikertelen');
}

export function createIngredient({ nev }) {
	return mutate({
		method: 'POST',
		endpoint: '/api/Hozzavalok',
		params: { nev },
		fallbackError: 'Hozzávaló létrehozása sikertelen',
	});
}

// ---------------------------------------------------------------------------
// Categories  (Kategóriák)
// ---------------------------------------------------------------------------

export function updateCategory({ id, nev }) {
	return mutate({
		method: 'PUT',
		endpoint: '/api/Kategoria',
		params: { id, nev },
		fallbackError: 'Kategória frissítése sikertelen',
	});
}

/** DELETE uses path param: /api/Kategoria/{id} */
export function deleteCategory(id) {
	return deletePath('/api/Kategoria', id, 'Kategória törlése sikertelen');
}

export function createCategory({ nev }) {
	return mutate({
		method: 'POST',
		endpoint: '/api/Kategoria',
		params: { nev },
		fallbackError: 'Kategória létrehozása sikertelen',
	});
}

// ---------------------------------------------------------------------------
// Meals  (Készételek)
// ---------------------------------------------------------------------------

export function updateMeal({ id, nev, leiras, elerheto, kategoriaId, ar, kepFile, hozzavalokIds = [] }) {
	return mutate({
		method: 'PUT',
		endpoint: '/api/Keszetelek',
		params: { id, nev, leiras, elerheto, ar, kategoriaId, hozzavalokIds },
		kepFile,
		fallbackError: 'Készétel frissítése sikertelen',
	});
}

/** DELETE uses path param: /api/Keszetelek/{id} */
export function deleteMeal(id) {
	return deletePath('/api/Keszetelek', id, 'Készétel törlése sikertelen');
}


export function createMeal({ nev, leiras, elerheto, kategoriaId, ar, kepFile, hozzavalokIds = [] }) {
	return mutate({
		method: 'POST',
		endpoint: '/api/Keszetelek',
		params: { nev, leiras, ar, elerheto, kategoriaId, hozzavalokIds },
		kepFile,
		fallbackError: 'Készétel létrehozása sikertelen',
	});
}

// ---------------------------------------------------------------------------
// Sides  (Köretek)
// ---------------------------------------------------------------------------

export function updateSide({ id, nev, leiras, elerheto, ar, kepFile }) {
	return mutate({
		method: 'PUT',
		endpoint: '/api/Koretek',
		params: { id, nev, leiras, elerheto, ar },
		kepFile,
		fallbackError: 'Köret frissítése sikertelen',
	});
}

/** DELETE uses path param: /api/Koretek/{id} */
export function deleteSide(id) {
	return deletePath('/api/Koretek', id, 'Köret törlése sikertelen');
}

export function createSide({ nev, leiras, elerheto, ar, kepFile }) {
	return mutate({
		method: 'POST',
		endpoint: '/api/Koretek',
		params: { nev, leiras, ar, elerheto },
		kepFile,
		fallbackError: 'Köret létrehozása sikertelen',
	});
}

// ---------------------------------------------------------------------------
// Menus  (Menük)
// ---------------------------------------------------------------------------

export function updateMenu({ id, menuNev, keszetelId, koretId, uditoId, elerheto, ar, kepFile }) {
	const params = { id, menuNev, keszetelId, koretId, uditoId, elerheto, ar };
	return mutate({ method: 'PUT', endpoint: '/api/Menuk', params, kepFile, fallbackError: 'Menü frissítése sikertelen' });
}

/** DELETE uses path param: /api/Menuk/{id} */
export function deleteMenu(id) {
	return deletePath('/api/Menuk', id, 'Menü törlése sikertelen');
}

export function createMenu({ menuNev, ar, keszetelId, koretId, uditoId, elerheto, kepFile }) {
	const params = { menuNev, ar, keszetelId, koretId, uditoId, elerheto };
	return mutate({ method: 'POST', endpoint: '/api/Menuk', params, kepFile, fallbackError: 'Menü létrehozása sikertelen' });
}

// ---------------------------------------------------------------------------
// Drinks  (Üdítők)
// ---------------------------------------------------------------------------

export function updateDrink({ id, nev, elerheto, ar, kepFile }) {
	return mutate({
		method: 'PUT',
		endpoint: '/api/Uditok',
		params: { id, nev, elerheto, ar },
		kepFile,
		fallbackError: 'Üdítő frissítése sikertelen',
	});
}

/** DELETE uses path param: /api/Uditok/{id} */
export function deleteDrink(id) {
	return deletePath('/api/Uditok', id, 'Üdítő törlése sikertelen');
}

export function createDrink({ nev, elerheto, ar, kepFile }) {
	return mutate({
		method: 'POST',
		endpoint: '/api/Uditok',
		params: { nev, ar, elerheto },
		kepFile,
		fallbackError: 'Üdítő létrehozása sikertelen',
	});
}
