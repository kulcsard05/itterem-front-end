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
export const PANEL_PREFS_KEY = 'employeeOrdersPanelPrefs';
export const MENU_CACHE_STORAGE_KEY = 'menu-cache-v1';
export const MENU_ETAG_STORAGE_KEY = 'menu-etags-v1';

// ── Auth events ─────────────────────────────────────────────────
export const AUTH_EXPIRED_EVENT = 'itterem:auth-expired';
export const AUTH_EXPIRED_MESSAGE = 'A bejelentkezés lejárt. Kérjük, jelentkezz be újra.';

// ── SSE configuration ───────────────────────────────────────────
export const SSE_MAX_RECONNECT_DELAY = 30_000;
export const SSE_BASE_RECONNECT_DELAY = 750;
export const SSE_MAX_RECONNECT_EXPONENT = 6;
export const SSE_OPEN_WATCHDOG_TIMEOUT = 8000;
export const SSE_SEEN_MAP_LIMIT = 300;
export const SSE_SEEN_MAP_TRIM_TO = 250;
export const SSE_MARK_DURATION = 90_000;

// ── Timeouts ────────────────────────────────────────────────────
export const ORDER_TIMEOUT_MS = 15_000;
export const POLL_INTERVAL_MS = 15_000;
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
