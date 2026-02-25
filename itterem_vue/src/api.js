import {
	AUTH_EXPIRED_MESSAGE,
	clearStoredAuth,
	getApiBaseUrl,
	readStoredAuth,
} from './utils.js';

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

	const looksJson =
		contentType.includes('application/json') ||
		raw.trim().startsWith('{') ||
		raw.trim().startsWith('[') ||
		raw.trim().startsWith('"');

	if (looksJson) {
		try {
			return JSON.parse(raw);
		} catch {
			return raw;
		}
	}

	return raw;
}

async function requestOk(response, fallbackErrorMessage) {
	const body = await readJsonOrText(response);
	if (response.ok) return { ok: true, data: body };

	if (response.status === 401) {
		clearStoredAuth({ emitEvent: true, reason: 'unauthorized' });
		return { ok: false, message: AUTH_EXPIRED_MESSAGE };
	}

	const message = typeof body === 'string' ? body : body?.message || fallbackErrorMessage;
	return { ok: false, message };
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
 * @returns {Promise<{ok: boolean, data?: *, message?: string}>}
 */
async function mutate({ method, endpoint, params = {}, kepFile, fallbackError }) {
	const baseUrl = getApiBaseUrl();

	// Build query string — stringify every value so URLSearchParams is happy.
	const searchParams = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) {
		searchParams.set(k, String(v ?? ''));
	}

	const url = `${baseUrl}${endpoint}?${searchParams.toString()}`;

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

	const response = await fetch(url, {
		method,
		headers,
		body,
	});

	return requestOk(response, fallbackError);
}

/**
 * DELETE where the id is part of the URL path (e.g. /api/Hozzavalok/5).
 * Most entities use this pattern.
 */
async function deletePath(endpoint, id, fallbackError) {
	const baseUrl = getApiBaseUrl();
	const response = await fetch(`${baseUrl}${endpoint}/${encodeURIComponent(String(id))}`, {
		method: 'DELETE',
		headers: authHeaders(),
	});
	return requestOk(response, fallbackError);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function login(email, password) {
	const baseUrl = getApiBaseUrl();

	const response = await fetch(`${baseUrl}/api/Login`, {
		method: 'POST',
		headers: { accept: '*/*', 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, passwd: password }),
	});

	const body = await readJsonOrText(response);

	if (response.ok) return { ok: true, user: body };
	if (typeof body === 'string') return { ok: false, message: body };
	return { ok: false, message: 'Bejelentkezés sikertelen' };
}

export async function register({ teljesNev, email, password, telefonSzam }) {
	const baseUrl = getApiBaseUrl();

	const response = await fetch(`${baseUrl}/api/Registration`, {
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

	if (response.ok) return { ok: true, data: body };
	if (typeof body === 'string') return { ok: false, message: body };
	return { ok: false, message: body?.message || 'Regisztráció sikertelen' };
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
		const response = await fetch(url, {
			method: 'GET',
			headers: authHeaders(),
		});

		const body = await readJsonOrText(response);

		if (!response.ok) {
			if (response.status === 401) {
				clearStoredAuth({ emitEvent: true, reason: 'unauthorized' });
				throw new Error(AUTH_EXPIRED_MESSAGE);
			}

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

export function getCategories() {
	return getList('/api/Kategoria', 'Kategóriák betöltése sikertelen', ['categories']);
}

/** Keszetelek = Készételek */
export function getMeals() {
	return getList('/api/Keszetelek', 'Készételek betöltése sikertelen');
}

/** Koretek = Köretek */
export function getSides() {
	return getList('/api/Koretek', 'Köretek betöltése sikertelen');
}

export function getMenus() {
	return getList('/api/Menuk', 'Menük betöltése sikertelen');
}

export function getDrinks() {
	return getList('/api/Uditok', 'Üdítők betöltése sikertelen');
}

// ---------------------------------------------------------------------------
// Orders  (Rendelések)
// ---------------------------------------------------------------------------

export const ORDER_STATUSES = ['Függőben', 'Folyamatban', 'Átvehető', 'Átvett'];

export function getOrders() {
	return getList('/api/Rendelesek', 'Rendelések betöltése sikertelen');
}

export function getOwnOrders() {
	return getList('/api/Rendelesek/sajat', 'Saját rendelések betöltése sikertelen');
}

export function updateOrderStatus(id, status) {
	const normalizedStatus = String(status ?? '').trim();
	if (!ORDER_STATUSES.includes(normalizedStatus)) {
		return Promise.resolve({
			ok: false,
			message: `Érvénytelen státusz. Engedélyezett értékek: ${ORDER_STATUSES.join(', ')}`,
		});
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
 * @returns {Promise<{ok: boolean, data?: *, message?: string}>}
 */
export async function placeOrder(felhasznaloId, orderItems) {
	const baseUrl = getApiBaseUrl();
	const response = await fetch(`${baseUrl}/api/Rendelesek`, {
		method: 'POST',
		headers: authHeaders({ 'Content-Type': 'application/json' }),
		body: JSON.stringify({ felhasznaloId, items: orderItems }),
	});
	return requestOk(response, 'Rendelés leadása sikertelen');
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

export function updateMeal({ id, nev, leiras, elerheto, kategoriaId, ar, kepFile }) {
	return mutate({
		method: 'PUT',
		endpoint: '/api/Keszetelek',
		params: { id, nev, leiras, elerheto, ar, Kategoria: kategoriaId },
		kepFile,
		fallbackError: 'Készétel frissítése sikertelen',
	});
}

/** DELETE uses path param: /api/Keszetelek/{id} */
export function deleteMeal(id) {
	return deletePath('/api/Keszetelek', id, 'Készétel törlése sikertelen');
}

export function createMeal({ nev, leiras, elerheto, katid, ar, kepFile }) {
	return mutate({
		method: 'POST',
		endpoint: '/api/Keszetelek',
		params: { nev, leiras, ar, elerheto, katid },
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
	const params = { id, menuNev, keszetelId, koretId, elerheto, ar };
	// uditoId can be NULL — only include when set.
	if (uditoId != null && String(uditoId).trim() !== '') {
		params.uditoId = uditoId;
	}
	return mutate({ method: 'PUT', endpoint: '/api/Menuk', params, kepFile, fallbackError: 'Menü frissítése sikertelen' });
}

/** DELETE uses path param: /api/Menuk/{id} */
export function deleteMenu(id) {
	return deletePath('/api/Menuk', id, 'Menü törlése sikertelen');
}

export function createMenu({ menuNev, ar, keszetelId, koretId, uditoId, elerheto, kepFile }) {
	const params = { menuNev, ar, keszetelId, koretId, elerheto };
	if (uditoId != null && String(uditoId).trim() !== '') {
		params.uditoId = uditoId;
	}
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
