const DEFAULT_API_BASE_URL = 'https://localhost:7200';

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
