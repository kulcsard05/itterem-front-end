const DEFAULT_API_BASE_URL = 'https://localhost:7200';

// Development mode - set to true to bypass backend authentication
// You can also set VITE_DEV_MODE_AUTH=true in your .env file
const DEV_MODE_AUTH = import.meta.env.VITE_DEV_MODE_AUTH === 'true' || false; // Change to false to disable

function stripTrailingSlashes(value) {
  return String(value || '').replace(/\/+$/, '');
}

export function getApiBaseUrl() {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (envBaseUrl) return stripTrailingSlashes(envBaseUrl);

  // In dev, prefer Vite proxy to avoid CORS/cert pain.
  if (import.meta.env.DEV) {
    const useProxyRaw = import.meta.env.VITE_USE_DEV_PROXY;
    const useProxy = useProxyRaw == null ? true : String(useProxyRaw).toLowerCase() === 'true';
    return useProxy ? '' : stripTrailingSlashes(DEFAULT_API_BASE_URL);
  }

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
  // ========== DEV MODE: Mock Authentication ==========
  // To disable: Set DEV_MODE_AUTH = false at the top of this file
  if (DEV_MODE_AUTH) {
    console.log('🔧 DEV MODE: Using mock authentication');
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Accept any credentials and return mock user data
    return {
      ok: true,
      user: {
        token: 'mock-dev-token-12345',
        teljesNev: 'Admin Felhasználó (DEV)',
        email: email || 'dev@test.hu',
        telefonszam: '+36 30 1234567',
        jogosultsag: 1,
        id: 999
      }
    };
  }
  // ========== END DEV MODE ==========

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

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value ?? ''));
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function register({ teljesNev, email, password, telefonSzam }) {
  const baseUrl = getApiBaseUrl();
  //const hash = await sha256Hex(password);
  const hash = password;

  const response = await fetch(`${baseUrl}/api/Registration`, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      teljesNev,
      email,
      hash,
      telefonSzam,
    }),
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
