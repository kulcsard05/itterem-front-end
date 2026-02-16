const DEFAULT_API_BASE_URL = 'https://localhost:7200';

function stripTrailingSlashes(value) {
	return String(value || '').replace(/\/+$/, '');
}

export function getApiBaseUrl() {
	const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
	if (envBaseUrl !== undefined) return stripTrailingSlashes(envBaseUrl);

	return stripTrailingSlashes(DEFAULT_API_BASE_URL);
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

	const response = await fetch(url, {
		method: 'GET',
		headers: {
			accept: '*/*',
		},
	});

	const body = await readJsonOrText(response);

	if (!response.ok) {
		throw new Error(typeof body === 'string' ? body : fallbackErrorMessage);
	}

	if (Array.isArray(body)) return body;
	if (body && Array.isArray(body.data)) return body.data;
	for (const key of extraArrayKeys) {
		if (body && Array.isArray(body[key])) return body[key];
	}

	return [];
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
