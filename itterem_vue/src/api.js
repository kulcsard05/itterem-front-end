import {
	AUTH_EXPIRED_MESSAGE,
	clearStoredAuth,
	getApiBaseUrl,
	isAuthPayload,
	readStoredAuth,
} from './utils.js';
import { MENU_ETAG_STORAGE_KEY } from './constants.js';
import { i18n } from './i18n.js';

// ---------------------------------------------------------------------------
// Fetch with timeout — prevents requests from hanging indefinitely.
// ---------------------------------------------------------------------------

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

async function abortableFetch(url, options = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
	if (!timeoutMs || timeoutMs <= 0) return fetch(url, options);

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		return await fetch(url, { ...options, signal: controller.signal });
	} catch (err) {
		if (err.name === 'AbortError') {
			throw new Error(i18n.global.t('api.errors.timeout'));
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

async function requestJsonOrThrow(response, fallbackErrorMessage) {
	const body = await readJsonOrText(response);
	if (response.ok) return body;

	if (response.status === 401) handleAuthFailure();

	const message = typeof body === 'string' ? body : body?.message || fallbackErrorMessage;
	throw new Error(message || fallbackErrorMessage);
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

	return requestJsonOrThrow(response, fallbackError);
}

async function getById(endpoint, id, fallbackError) {
	const baseUrl = getApiBaseUrl();
	const url = `${baseUrl}${endpoint}/${encodeURIComponent(String(id ?? ''))}`;
	const response = await abortableFetch(url, { method: 'GET', headers: authHeaders() });
	return requestJsonOrThrow(response, fallbackError);
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
	return requestJsonOrThrow(response, fallbackError);
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
			if (!isAuthPayload(body, { requireToken: true })) {
				throw new Error(body?.message || 'Bejelentkezés sikertelen');
			}
			return body;
		}
		if (response.status === 401) {
			throw new Error('Hibás email vagy jelszó');
		}
		if (typeof body === 'string') throw new Error(body);
		throw new Error(body?.message || 'Bejelentkezés sikertelen');
	} catch (error) {
		if (error instanceof Error) throw error;
		throw new Error('Hálózati hiba – ellenőrizd az internetkapcsolatot');
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
		if (typeof body === 'string') throw new Error(body);
		throw new Error(body?.message || 'Regisztráció sikertelen');
	} catch (error) {
		if (error instanceof Error) throw error;
		throw new Error('Hálózati hiba – ellenőrizd az internetkapcsolatot');
	}
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

		const body = await readJsonOrText(response);

		if (!response.ok) {
			if (response.status === 401) handleAuthFailure();

			throw new Error(typeof body === 'string' ? body : fallbackErrorMessage);
		}

		let list = [];
		if (Array.isArray(body)) {
			list = body;
		} else if (body && Array.isArray(body.data)) {
			list = body.data;
		} else {
			for (const key of extraArrayKeys) {
				if (body && Array.isArray(body[key])) {
					list = body[key];
					break;
				}
			}
		}

		return list;
	} catch (error) {
		if (error instanceof Error && error.message === AUTH_EXPIRED_MESSAGE) {
			throw error;
		}
		if (error instanceof Error) throw error;
		throw new Error(fallbackErrorMessage);
	}
}

function readMenuEtags() {
	try {
		const raw = localStorage.getItem(MENU_ETAG_STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

function writeMenuEtag(key, value) {
	if (!key || !value) return;
	try {
		const etags = readMenuEtags();
		etags[key] = value;
		localStorage.setItem(MENU_ETAG_STORAGE_KEY, JSON.stringify(etags));
	} catch {
		// ignore storage write failures
	}
}

function deleteMenuEtag(key) {
	if (!key) return;
	try {
		const etags = readMenuEtags();
		if (!(key in etags)) return;
		delete etags[key];
		localStorage.setItem(MENU_ETAG_STORAGE_KEY, JSON.stringify(etags));
	} catch {
		// ignore storage write failures
	}
}

function extractListFromBody(body, extraArrayKeys = []) {
	if (Array.isArray(body)) return body;
	if (body && Array.isArray(body.data)) return body.data;

	for (const key of extraArrayKeys) {
		if (body && Array.isArray(body[key])) return body[key];
	}

	return [];
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
			cache: 'no-cache',
		});

		if (response.status === 304) {
			return { notModified: true, data: null };
		}

		const body = await readJsonOrText(response);

		if (!response.ok) {
			if (response.status === 401) handleAuthFailure();
			throw new Error(typeof body === 'string' ? body : fallbackErrorMessage);
		}

		const nextEtag = response.headers.get('etag');
		if (nextEtag) writeMenuEtag(etagKey, nextEtag);
		else deleteMenuEtag(etagKey);

		return {
			notModified: false,
			data: extractListFromBody(body, extraArrayKeys),
		};
	} catch (error) {
		if (error instanceof Error && error.message === AUTH_EXPIRED_MESSAGE) {
			throw error;
		}
		if (error instanceof Error) throw error;
		throw new Error(fallbackErrorMessage);
	}
}

export function getCategories() {
	return getList('/api/Kategoria', 'Kategóriák betöltése sikertelen', ['categories']);
}

export function getCategoriesConditional() {
	return getListWithEtag('/api/Kategoria', 'Kategóriák betöltése sikertelen', ['categories'], 'categories');
}

/** Keszetelek = Készételek */
export function getMeals() {
	return getList('/api/Keszetelek', 'Készételek betöltése sikertelen');
}

export function getMealsConditional() {
	return getListWithEtag('/api/Keszetelek', 'Készételek betöltése sikertelen', [], 'meals');
}

export function getMealById(id) {
	return getById('/api/Keszetelek', id, 'Készétel betöltése sikertelen');
}

/** Koretek = Köretek */
export function getSides() {
	return getList('/api/Koretek', 'Köretek betöltése sikertelen');
}

export function getSidesConditional() {
	return getListWithEtag('/api/Koretek', 'Köretek betöltése sikertelen', [], 'sides');
}

export function getMenus() {
	return getList('/api/Menuk', 'Menük betöltése sikertelen');
}

export function getMenusConditional() {
	return getListWithEtag('/api/Menuk', 'Menük betöltése sikertelen', [], 'menus');
}

export function getDrinks() {
	return getList('/api/Uditok', 'Üdítők betöltése sikertelen');
}

export function getDrinksConditional() {
	return getListWithEtag('/api/Uditok', 'Üdítők betöltése sikertelen', [], 'drinks');
}

// ---------------------------------------------------------------------------
// Orders  (Rendelések)
// ---------------------------------------------------------------------------

// Re-export from constants.js so existing callers keep working.
import { ORDER_STATUSES } from './constants.js';
export { ORDER_STATUSES };

export function getOrders() {
	return getList('/api/Rendelesek', 'Rendelések betöltése sikertelen');
}

export function getOwnOrders() {
	return getList('/api/Rendelesek/sajat', 'Saját rendelések betöltése sikertelen');
}

export function updateOrderStatus(id, status) {
	const normalizedStatus = String(status ?? '').trim();
	if (!ORDER_STATUSES.includes(normalizedStatus)) {
		throw new Error(`Érvénytelen státusz. Engedélyezett értékek: ${ORDER_STATUSES.join(', ')}`);
	}

	return mutate({
		method: 'PUT',
		endpoint: `/api/Rendelesek/${encodeURIComponent(String(id ?? ''))}`,
		params: { status: normalizedStatus },
		fallbackError: 'Rendelés státusz frissítése sikertelen',
	});
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
	const baseUrl = getApiBaseUrl();
	const response = await abortableFetch(`${baseUrl}/api/Rendelesek`, {
		method: 'POST',
		headers: authHeaders({ 'Content-Type': 'application/json' }),
		body: JSON.stringify({ felhasznaloId, items: orderItems }),
	});
	return requestJsonOrThrow(response, 'Rendelés leadása sikertelen');
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
	return getList('/api/Hozzavalok', 'Hozzávalók betöltése sikertelen', ['hozzavalok', 'ingredients']);
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
