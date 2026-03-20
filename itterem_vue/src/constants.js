// ---------------------------------------------------------------------------
// Centralized constants for the Itterem application.
// ---------------------------------------------------------------------------

// ── Roles ───────────────────────────────────────────────────────
export const ROLE_USER = 1;
export const ROLE_EMPLOYEE = 2;
export const ROLE_ADMIN = 3;

// ── Order statuses ──────────────────────────────────────────────
export const ORDER_STATUSES = ['Függőben', 'Folyamatban', 'Átvehető', 'Átvett'];

export const ORDER_STATUS_CLASSES = {
	Függőben: 'bg-orange-100 text-orange-800',
	Folyamatban: 'bg-yellow-100 text-yellow-800',
	Átvehető: 'bg-green-100 text-green-800 status-atvehetö',
	Átvett: 'bg-blue-100 text-blue-800',
};

// ── localStorage / sessionStorage keys ──────────────────────────
export const AUTH_STORAGE_KEY = 'auth';
export const CART_STORAGE_KEY = 'cart';
export const LOCALE_STORAGE_KEY = 'itterem-locale';
export const PANEL_PREFS_KEY = 'employeeOrdersPanelPrefs';
export const MENU_CACHE_STORAGE_KEY = 'menu-cache-v1';
export const MENU_ETAG_STORAGE_KEY = 'menu-etags-v1';
export const MENU_IMAGES_STORAGE_KEY = 'menu-images-v1';
export const SERVER_URL_STORAGE_KEY = 'itterem-server-url';

// ── locale configuration ────────────────────────────────────────
export const DEFAULT_LOCALE = 'hu';
export const FALLBACK_LOCALE = 'hu';
export const SUPPORTED_LOCALES = ['hu', 'en'];
export const LOCALE_QUERY_KEY = 'lang';

// ── Auth events ─────────────────────────────────────────────────
export const AUTH_EXPIRED_EVENT = 'itterem:auth-expired';
export const AUTH_EXPIRED_MESSAGE = 'A bejelentkezés lejárt. Kérjük, jelentkezz be újra.';

// ── SignalR configuration ────────────────────────────────────────
export const SIGNALR_HUB_PATH = '/orderHub';

// ── Timeouts ────────────────────────────────────────────────────
export const ORDER_TIMEOUT_MS = 15_000;
export const POLL_INTERVAL_MS = 15_000;
export const ENABLE_EMPLOYEE_ORDER_POLLING = false;
export const DONE_NOTICE_TIMEOUT_MS = 8000;

// ── Panel defaults ──────────────────────────────────────────────
export const PANEL_MIN_WIDTH = 320;
export const PANEL_MIN_HEIGHT = 220;
export const PANEL_DEFAULT_WIDTH = 460;
export const PANEL_DEFAULT_HEIGHT = 280;
export const PANEL_FONT_MIN = 12;
export const PANEL_FONT_MAX = 28;

// ── Validation ──────────────────────────────────────────────────
export const PASSWORD_MIN_LENGTH = 6;
export const MAX_ORDER_QUANTITY = 50;
