import { randomSaltHex, sha256Hex } from './authCrypto';

const DEFAULT_API_BASE_URL = 'http://localhost:5258';

function getApiBaseUrl() {
  const envBaseUrl = process.env.REACT_APP_API_BASE_URL;
  if (envBaseUrl) return envBaseUrl.replace(/\/+$/, '');

  if (process.env.NODE_ENV === 'development') {
    const useProxy = String(process.env.REACT_APP_USE_DEV_PROXY || '').toLowerCase() === 'true';
    return useProxy ? '' : DEFAULT_API_BASE_URL.replace(/\/+$/, '');
  }

  return DEFAULT_API_BASE_URL.replace(/\/+$/, '');
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

export async function getSalt(email) {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/Login/GetSalt?email=${encodeURIComponent(email)}`;

  const response = await fetch(url, {
    method: 'GET',
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const body = await readJsonOrText(response);
    throw new Error(typeof body === 'string' ? body : 'Failed to fetch salt');
  }

  const body = await readJsonOrText(response);
  if (typeof body === 'string') return body;
  return String(body);
}

export async function login(email, password) {
  const baseUrl = getApiBaseUrl();

  const response = await fetch(`${baseUrl}/api/Login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, passwd: password }),
  });

  const body = await readJsonOrText(response);

  if (response.ok && body && typeof body === 'object' && body.token) {
    return { ok: true, user: body };
  }

  if (typeof body === 'string') {
    return { ok: false, message: body };
  }

  return { ok: false, message: 'Hibás név vagy jelszó' };
}

export async function register({ fullName, email, phone, password }) {
  const baseUrl = getApiBaseUrl();
  const salt = randomSaltHex(16);
  const tmpHASH = sha256Hex(password);

  const payload = {
    id: 0,
    jogosultsag: 0,
    teljesNev: fullName,
    email,
    telefonSzam: phone,
    hash: `${tmpHASH}${salt}`,
    salt,
    aktiv: 0,
  };

  const response = await fetch(`${baseUrl}/api/Registration`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await readJsonOrText(response);

  if (!response.ok) {
    throw new Error(typeof body === 'string' ? body : 'Registration failed');
  }

  return {
    ok: true,
    message: typeof body === 'string' ? body : 'Sikeres regisztráció',
  };
}
