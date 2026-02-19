const DEFAULT_API_BASE_URL = 'https://localhost:7200';
const LIST_CACHE_PREFIX = 'itterem:list:';

function stripTrailingSlashes(value) {
	return String(value || '').replace(/\/+$/, '');
}

export function getApiBaseUrl() {
	const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
	if (envBaseUrl !== undefined) return stripTrailingSlashes(envBaseUrl);
	return stripTrailingSlashes(DEFAULT_API_BASE_URL);
}

export function getListCacheKey(endpointPath) {
	return `${LIST_CACHE_PREFIX}${String(endpointPath || '')
		.trim()
		.toLowerCase()}`;
}

function writeListCache(endpointPath, list) {
	try {
		const key = getListCacheKey(endpointPath);
		localStorage.setItem(key, JSON.stringify(Array.isArray(list) ? list : []));
	} catch {
		// Ignore cache write errors.
	}
}

function readListCache(endpointPath) {
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
	if (kepFile instanceof File) {
		const fd = new FormData();
		fd.append('kep', kepFile, kepFile.name || 'image');
		body = fd;
	} else if (method === 'POST') {
		body = '';
	}

	const response = await fetch(url, {
		method,
		headers: { accept: '*/*' },
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
		headers: { accept: '*/*' },
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
	return { ok: false, message: 'Login failed' };
}

export async function register({ teljesNev, email, password, telefonSzam }) {
	const baseUrl = getApiBaseUrl();
	const params = new URLSearchParams({
		teljes_nev: String(teljesNev ?? '').trim(),
		email: String(email ?? '').trim(),
		jelszo: String(password ?? ''),
		telefonszam: String(telefonSzam ?? '').trim(),
	});

	const response = await fetch(`${baseUrl}/api/Registration?${params.toString()}`, {
		method: 'POST',
		headers: { accept: '*/*' },
		body: '',
	});

	const body = await readJsonOrText(response);

	if (response.ok) return { ok: true, data: body };
	if (typeof body === 'string') return { ok: false, message: body };
	return { ok: false, message: body?.message || 'Registration failed' };
}

// ---------------------------------------------------------------------------
// GET lists (with localStorage cache fallback)
// ---------------------------------------------------------------------------

async function getList(endpointPath, fallbackErrorMessage, extraArrayKeys = []) {
	const baseUrl = getApiBaseUrl();
	const url = baseUrl ? `${baseUrl}${endpointPath}` : endpointPath;

	try {
		const response = await fetch(url, {
			method: 'GET',
			headers: { accept: '*/*' },
		});

		const body = await readJsonOrText(response);

		if (!response.ok) {
			const cached = readListCache(endpointPath);
			if (cached.length > 0) return cached;
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

		writeListCache(endpointPath, list);
		return list;
	} catch (error) {
		const cached = readListCache(endpointPath);
		if (cached.length > 0) return cached;
		if (error instanceof Error) throw error;
		throw new Error(fallbackErrorMessage);
	}
}

export function getCategories() {
	return getList('/api/Kategoria', 'Failed to fetch categories', ['categories']);
}

/** Keszetelek = Meals */
export function getMeals() {
	return getList('/api/Keszetelek', 'Failed to fetch meals');
}

/** Koretek = Sides */
export function getSides() {
	return getList('/api/Koretek', 'Failed to fetch sides');
}

export function getMenus() {
	return getList('/api/Menuk', 'Failed to fetch menus');
}

export function getDrinks() {
	return getList('/api/Uditok', 'Failed to fetch drinks');
}

/** Hozzavalok = Ingredients */
export function getIngredients() {
	return getList('/api/Hozzavalok', 'Failed to fetch ingredients', ['hozzavalok', 'ingredients']);
}

// ---------------------------------------------------------------------------
// Ingredients  (Hozzávalók)
// ---------------------------------------------------------------------------

export function updateIngredient({ id, nev }) {
	return mutate({
		method: 'PUT',
		endpoint: '/api/Hozzavalok',
		params: { id, nev },
		fallbackError: 'Failed to update ingredient',
	});
}

/** DELETE uses path param: /api/Hozzavalok/{id} */
export function deleteIngredient(id) {
	return deletePath('/api/Hozzavalok', id, 'Failed to delete ingredient');
}

export function createIngredient({ nev }) {
	return mutate({
		method: 'POST',
		endpoint: '/api/Hozzavalok',
		params: { nev },
		fallbackError: 'Failed to create ingredient',
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
		fallbackError: 'Failed to update category',
	});
}

/** DELETE uses path param: /api/Kategoria/{id} */
export function deleteCategory(id) {
	return deletePath('/api/Kategoria', id, 'Failed to delete category');
}

export function createCategory({ nev }) {
	return mutate({
		method: 'POST',
		endpoint: '/api/Kategoria',
		params: { nev },
		fallbackError: 'Failed to create category',
	});
}

// ---------------------------------------------------------------------------
// Meals  (Készételek)
// ---------------------------------------------------------------------------

export function updateMeal({ id, nev, leiras, elerheto, kategoriaId, ar, kepFile }) {
	return mutate({
		method: 'PUT',
		endpoint: '/api/Keszetelek',
		params: { id, nev, leiras, elerheto, ar, Kategora: kategoriaId },
		kepFile,
		fallbackError: 'Failed to update meal',
	});
}

/** DELETE uses path param: /api/Keszetelek/{id} */
export function deleteMeal(id) {
	return deletePath('/api/Keszetelek', id, 'Failed to delete meal');
}

export function createMeal({ nev, leiras, elerheto, katid, ar, kepFile }) {
	return mutate({
		method: 'POST',
		endpoint: '/api/Keszetelek',
		params: { nev, leiras, ar, elerheto, katid },
		kepFile,
		fallbackError: 'Failed to create meal',
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
		fallbackError: 'Failed to update side',
	});
}

/** DELETE uses path param: /api/Koretek/{id} */
export function deleteSide(id) {
	return deletePath('/api/Koretek', id, 'Failed to delete side');
}

export function createSide({ nev, leiras, elerheto, ar, kepFile }) {
	return mutate({
		method: 'POST',
		endpoint: '/api/Koretek',
		params: { nev, leiras, ar, elerheto },
		kepFile,
		fallbackError: 'Failed to create side',
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
	return mutate({ method: 'PUT', endpoint: '/api/Menuk', params, kepFile, fallbackError: 'Failed to update menu' });
}

/** DELETE uses path param: /api/Menuk/{id} */
export function deleteMenu(id) {
	return deletePath('/api/Menuk', id, 'Failed to delete menu');
}

export function createMenu({ menuNev, ar, keszetelId, koretId, uditoId, elerheto, kepFile }) {
	const params = { menuNev, ar, keszetelId, koretId, elerheto };
	if (uditoId != null && String(uditoId).trim() !== '') {
		params.uditoId = uditoId;
	}
	return mutate({ method: 'POST', endpoint: '/api/Menuk', params, kepFile, fallbackError: 'Failed to create menu' });
}

// ---------------------------------------------------------------------------
// Drinks  (Üdítők)
//
// NOTE: The backend uses a DIFFERENT delete pattern for drinks.
// Instead of /api/Uditok/{id}  (path param), it expects  /api/Uditok?id={id}  (query param).
// This is a backend inconsistency; do NOT change without updating the backend.
// ---------------------------------------------------------------------------

export function updateDrink({ id, nev, elerheto, ar, kepFile }) {
	return mutate({
		method: 'PUT',
		endpoint: '/api/Uditok',
		params: { id, nev, elerheto, ar },
		kepFile,
		fallbackError: 'Failed to update drink',
	});
}

/**
 * DELETE uses **query param**: /api/Uditok?id={id}
 * (Unlike all other entities which use path param. This is required by the backend.)
 */
export function deleteDrink(id) {
	return mutate({
		method: 'DELETE',
		endpoint: '/api/Uditok',
		params: { id },
		fallbackError: 'Failed to delete drink',
	});
}

export function createDrink({ nev, elerheto, ar, kepFile }) {
	return mutate({
		method: 'POST',
		endpoint: '/api/Uditok',
		params: { nev, ar, elerheto },
		kepFile,
		fallbackError: 'Failed to create drink',
	});
}
