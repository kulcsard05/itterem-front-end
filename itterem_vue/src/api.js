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
	return `${LIST_CACHE_PREFIX}${String(endpointPath || '').trim().toLowerCase()}`;
}

function writeListCache(endpointPath, list) {
	try {
		const key = getListCacheKey(endpointPath);
		localStorage.setItem(
			key,
			JSON.stringify({
				updatedAt: Date.now(),
				data: Array.isArray(list) ? list : [],
			})
		);
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

export async function login(email, password) {
	const baseUrl = getApiBaseUrl();

	const response = await fetch(`${baseUrl}/api/Login`, {
		method: 'POST',
		headers: {
		accept: '*/*',
		'Content-Type': 'application/json',
		},
		body: JSON.stringify({ email, passwd: password }),
	});

	const body = await readJsonOrText(response);

	console.log('Login response body:', body);

	if (response.ok) {
		return { ok: true, user: body };
	}

	if (typeof body === 'string') {
		return { ok: false, message: body };
	}

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
		headers: {
		accept: '*/*',
		},
		body: '',
	});

	const body = await readJsonOrText(response);

	if (response.ok) {
		return { ok: true, data: body };
	}

	if (typeof body === 'string') {
		return { ok: false, message: body };
	}

	return { ok: false, message: body?.message || 'Registration failed' };
}

async function getList(endpointPath, fallbackErrorMessage, extraArrayKeys = []) {
	const baseUrl = getApiBaseUrl();
	const url = baseUrl ? `${baseUrl}${endpointPath}` : endpointPath;

	try {
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				accept: '*/*',
			},
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

		console.log(`Fetched from ${endpointPath}:`, list);

		writeListCache(endpointPath, list);
		return list;
	} catch (error) {
		const cached = readListCache(endpointPath);
		if (cached.length > 0) return cached;
		if (error instanceof Error) throw error;
		throw new Error(fallbackErrorMessage);
	}
}

export async function getCategories() {
	return getList('/api/Kategoria', 'Failed to fetch categories', ['categories']);
}

// Keszetelek = Meals
export async function getMeals() {
	return getList('/api/Keszetelek', 'Failed to fetch meals');
}

// Koretek = Sides
export async function getSides() {
	return getList('/api/Koretek', 'Failed to fetch sides');
}

export async function getMenus() {
	return getList('/api/Menuk', 'Failed to fetch menus');
}

export async function getDrinks() {
	return getList('/api/Uditok', 'Failed to fetch drinks');
}

// Hozzavalok = Ingredients
export async function getIngredients() {
	return getList('/api/Hozzavalok', 'Failed to fetch ingredients', ['hozzavalok', 'ingredients']);
}

async function requestOk(response, fallbackErrorMessage) {
	const body = await readJsonOrText(response);
	if (response.ok) return { ok: true, data: body };
	const message = typeof body === 'string' ? body : body?.message || fallbackErrorMessage;
	return { ok: false, message };
}

export async function updateIngredient({ id, nev }) {
	const baseUrl = getApiBaseUrl();
	const params = new URLSearchParams({
		id: String(id ?? ''),
		nev: String(nev ?? ''),
	});

	const response = await fetch(`${baseUrl}/api/Hozzavalok?${params.toString()}`, {
		method: 'PUT',
		headers: { accept: '*/*' },
	});

	return requestOk(response, 'Failed to update ingredient');
}

export async function deleteIngredient(id) {
	const baseUrl = getApiBaseUrl();
	const response = await fetch(`${baseUrl}/api/Hozzavalok/${encodeURIComponent(String(id))}`, {
		method: 'DELETE',
		headers: { accept: '*/*' },
	});
	return requestOk(response, 'Failed to delete ingredient');
}

export async function createIngredient({ nev }) {
	const baseUrl = getApiBaseUrl();
	const params = new URLSearchParams({
		nev: String(nev ?? ''),
	});

	const response = await fetch(`${baseUrl}/api/Hozzavalok?${params.toString()}`, {
		method: 'POST',
		headers: { accept: '*/*' },
		body: '',
	});

	return requestOk(response, 'Failed to create ingredient');
}

export async function updateCategory({ id, nev }) {
	const baseUrl = getApiBaseUrl();
	const params = new URLSearchParams({
		id: String(id ?? ''),
		nev: String(nev ?? ''),
	});

	const response = await fetch(`${baseUrl}/api/Kategoria?${params.toString()}`, {
		method: 'PUT',
		headers: { accept: '*/*' },
	});

	return requestOk(response, 'Failed to update category');
}

export async function deleteCategory(id) {
	const baseUrl = getApiBaseUrl();
	const response = await fetch(`${baseUrl}/api/Kategoria/${encodeURIComponent(String(id))}`, {
		method: 'DELETE',
		headers: { accept: '*/*' },
	});
	return requestOk(response, 'Failed to delete category');
}

export async function createCategory({ nev }) {
	const baseUrl = getApiBaseUrl();
	const params = new URLSearchParams({
		nev: String(nev ?? ''),
	});

	const response = await fetch(`${baseUrl}/api/Kategoria?${params.toString()}`, {
		method: 'POST',
		headers: { accept: '*/*' },
		body: '',
	});

	return requestOk(response, 'Failed to create category');
}

function appendKepFile(formData, kepFile) {
	if (kepFile instanceof File) {
		formData.append('kep', kepFile, kepFile.name || 'image');
	}
}

export async function updateMeal({ id, nev, leiras, elerheto, kategoriaId, ar, kepFile }) {
	const baseUrl = getApiBaseUrl();
	const params = new URLSearchParams({
		id: String(id ?? ''),
		nev: String(nev ?? ''),
		leiras: String(leiras ?? ''),
		elerheto: String(elerheto ?? ''),
		ar: String(ar ?? ''),
		Kategoria: String(kategoriaId ?? ''),
	});

	const formData = new FormData();
	appendKepFile(formData, kepFile);

	const response = await fetch(`${baseUrl}/api/Keszetelek?${params.toString()}`, {
		method: 'PUT',
		headers: { accept: '*/*' },
		body: formData,
	});

	return requestOk(response, 'Failed to update meal');
}

export async function deleteMeal(id) {
	const baseUrl = getApiBaseUrl();
	const response = await fetch(`${baseUrl}/api/Keszetelek/${encodeURIComponent(String(id))}`, {
		method: 'DELETE',
		headers: { accept: '*/*' },
	});
	return requestOk(response, 'Failed to delete meal');
}

export async function createMeal({ nev, leiras, elerheto, katid, ar, kepFile }) {
	const baseUrl = getApiBaseUrl();
	const params = new URLSearchParams({
		nev: String(nev ?? ''),
		leiras: String(leiras ?? ''),
		ar: String(ar ?? ''),
		elerheto: String(elerheto ?? ''),
		katid: String(katid ?? ''),
	});

	const formData = new FormData();
	appendKepFile(formData, kepFile);

	const response = await fetch(`${baseUrl}/api/Keszetelek?${params.toString()}`, {
		method: 'POST',
		headers: { accept: '*/*' },
		body: formData,
	});

	return requestOk(response, 'Failed to create meal');
}

export async function updateSide({ id, nev, leiras, elerheto, ar, kepFile }) {
	const baseUrl = getApiBaseUrl();
	const params = new URLSearchParams({
		id: String(id ?? ''),
		nev: String(nev ?? ''),
		leiras: String(leiras ?? ''),
		elerheto: String(elerheto ?? ''),
		ar: String(ar ?? ''),
	});

	const formData = new FormData();
	appendKepFile(formData, kepFile);

	const response = await fetch(`${baseUrl}/api/Koretek?${params.toString()}`, {
		method: 'PUT',
		headers: { accept: '*/*' },
		body: formData,
	});

	return requestOk(response, 'Failed to update side');
}

export async function deleteSide(id) {
	const baseUrl = getApiBaseUrl();
	const response = await fetch(`${baseUrl}/api/Koretek/${encodeURIComponent(String(id))}`, {
		method: 'DELETE',
		headers: { accept: '*/*' },
	});
	return requestOk(response, 'Failed to delete side');
}

export async function createSide({ nev, leiras, elerheto, ar, kepFile }) {
	const baseUrl = getApiBaseUrl();
	const params = new URLSearchParams({
		nev: String(nev ?? ''),
		leiras: String(leiras ?? ''),
		ar: String(ar ?? ''),
		elerheto: String(elerheto ?? ''),
	});

	const formData = new FormData();
	appendKepFile(formData, kepFile);

	const response = await fetch(`${baseUrl}/api/Koretek?${params.toString()}`, {
		method: 'POST',
		headers: { accept: '*/*' },
		body: formData,
	});

	return requestOk(response, 'Failed to create side');
}

export async function updateMenu({ id, menuNev, keszetelId, koretId, uditoId, elerheto, ar, kepFile }) {
	const baseUrl = getApiBaseUrl();
	const params = new URLSearchParams({
		id: String(id ?? ''),
		menuNev: String(menuNev ?? ''),
		keszetelId: String(keszetelId ?? ''),
		koretId: String(koretId ?? ''),
		elerheto: String(elerheto ?? ''),
		ar: String(ar ?? ''),
	});

	// uditoId can be NULL -> omit from query when not set
	const uditoValue = uditoId === null || uditoId === undefined ? '' : String(uditoId);
	if (String(uditoValue).trim() !== '') {
		params.set('uditoId', String(uditoValue));
	}

	const formData = new FormData();
	appendKepFile(formData, kepFile);

	const response = await fetch(`${baseUrl}/api/Menuk?${params.toString()}`, {
		method: 'PUT',
		headers: { accept: '*/*' },
		body: formData,
	});

	return requestOk(response, 'Failed to update menu');
}

export async function deleteMenu(id) {
	const baseUrl = getApiBaseUrl();
	const response = await fetch(`${baseUrl}/api/Menuk/${encodeURIComponent(String(id))}`, {
		method: 'DELETE',
		headers: { accept: '*/*' },
	});
	return requestOk(response, 'Failed to delete menu');
}

export async function createMenu({ menuNev, ar, keszetelId, koretId, uditoId, elerheto, kepFile }) {
	const baseUrl = getApiBaseUrl();
	const params = new URLSearchParams({
		menuNev: String(menuNev ?? ''),
		ar: String(ar ?? ''),
		keszetelId: String(keszetelId ?? ''),
		koretId: String(koretId ?? ''),
		elerheto: String(elerheto ?? ''),
	});

	if (String(uditoId ?? '').trim() !== '') {
		params.set('uditoId', String(uditoId));
	}

	const formData = new FormData();
	appendKepFile(formData, kepFile);

	const response = await fetch(`${baseUrl}/api/Menuk?${params.toString()}`, {
		method: 'POST',
		headers: { accept: '*/*' },
		body: formData,
	});

	return requestOk(response, 'Failed to create menu');
}

export async function updateDrink({ id, nev, elerheto, ar, kepFile }) {
	const baseUrl = getApiBaseUrl();
	const params = new URLSearchParams({
		id: String(id ?? ''),
		nev: String(nev ?? ''),
		elerheto: String(elerheto ?? ''),
		ar: String(ar ?? ''),
	});

	const formData = new FormData();
	appendKepFile(formData, kepFile);

	const response = await fetch(`${baseUrl}/api/Uditok?${params.toString()}`, {
		method: 'PUT',
		headers: { accept: '*/*' },
		body: formData,
	});

	return requestOk(response, 'Failed to update drink');
}

export async function deleteDrink(id) {
	const baseUrl = getApiBaseUrl();
	const params = new URLSearchParams({ id: String(id ?? '') });
	const response = await fetch(`${baseUrl}/api/Uditok?${params.toString()}`, {
		method: 'DELETE',
		headers: { accept: '*/*' },
	});
	return requestOk(response, 'Failed to delete drink');
}

export async function createDrink({ nev, elerheto, ar, kepFile }) {
	const baseUrl = getApiBaseUrl();
	const params = new URLSearchParams({
		nev: String(nev ?? ''),
		ar: String(ar ?? ''),
		elerheto: String(elerheto ?? ''),
	});

	const formData = new FormData();
	appendKepFile(formData, kepFile);

	const response = await fetch(`${baseUrl}/api/Uditok?${params.toString()}`, {
		method: 'POST',
		headers: { accept: '*/*' },
		body: formData,
	});

	return requestOk(response, 'Failed to create drink');
}
