import { computed, onScopeDispose, ref } from 'vue';
import {
	AUTH_EXPIRED_EVENT,
	clearStoredAuth,
	getJwtExpirationMs,
	isAuthPayload,
	isJwtExpired,
	readStoredAuth,
} from '../utils.js';
import { AUTH_STORAGE_KEY, ROLE_EMPLOYEE, ROLE_ADMIN } from '../constants.js';

// ---------------------------------------------------------------------------
// Module-level singleton — every component shares the same auth state.
// ---------------------------------------------------------------------------

const auth = ref(null);
let authExpiryTimer = null;

// ── Migration (legacy phone field names) ────────────────────────
function migrateAuthShape(value) {
	if (!value || typeof value !== 'object') return { auth: value, changed: false };

	const legacyPhone = String(value.telefonszam ?? value.telefonSzam ?? value.telefon_szam ?? value.phone ?? '').trim();
	const next = { ...value };
	let changed = false;

	if (!String(next.telefonszam ?? '').trim() && legacyPhone) {
		next.telefonszam = legacyPhone;
		changed = true;
	}

	if ('telefonSzam' in next) {
		delete next.telefonSzam;
		changed = true;
	}
	if ('telefon_szam' in next) {
		delete next.telefon_szam;
		changed = true;
	}
	if ('phone' in next) {
		delete next.phone;
		changed = true;
	}

	return { auth: next, changed };
}

// Initialize from localStorage on first import.
try {
	const parsed = readStoredAuth();
	const migrated = migrateAuthShape(parsed);
	auth.value = migrated.auth;
	if (migrated.changed && migrated.auth) {
		localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(migrated.auth));
	}
} catch {
	auth.value = null;
}

// ── Timer management ────────────────────────────────────────────
function clearAuthExpiryTimer() {
	if (authExpiryTimer != null) {
		window.clearTimeout(authExpiryTimer);
		authExpiryTimer = null;
	}
}

function scheduleAuthExpiry(token, onExpired) {
	clearAuthExpiryTimer();
	if (!token) return;
	const expiryMs = getJwtExpirationMs(token);
	if (expiryMs == null) return;
	const delay = expiryMs - Date.now();
	if (delay <= 0) {
		onExpired?.();
		return;
	}
	authExpiryTimer = window.setTimeout(() => onExpired?.(), delay);
}

// ── Composable ──────────────────────────────────────────────────

export function useAuth() {
	const isLoggedIn = computed(() => Boolean(auth.value && auth.value.token));
	const isAdmin = computed(() => Number(auth.value?.jogosultsag) === ROLE_ADMIN);
	const isEmployee = computed(() => Number(auth.value?.jogosultsag) === ROLE_EMPLOYEE);

	// Cleanup timer and storage listeners when the calling scope is disposed.
	onScopeDispose(() => {
		clearAuthExpiryTimer();
	});

	function setAuth(user) {
		const migrated = migrateAuthShape(user);
		if (!isAuthPayload(migrated.auth)) {
			clearStoredAuth();
			auth.value = null;
			return;
		}

		localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(migrated.auth));
		auth.value = migrated.auth;
	}

	function logout() {
		clearStoredAuth();
		auth.value = null;
	}

	function handleStorageChange(event) {
		if (event.key !== AUTH_STORAGE_KEY) return;
		const next = readStoredAuth();
		if (
			!next?.token ||
			isJwtExpired(next.token) ||
			(auth.value && String(next.jogosultsag) !== String(auth.value.jogosultsag))
		) {
			logout();
		}
	}

	function handleAuthExpired() {
		logout();
	}

	return {
		auth,
		isLoggedIn,
		isAdmin,
		isEmployee,
		setAuth,
		logout,
		scheduleAuthExpiry,
		clearAuthExpiryTimer,
		handleStorageChange,
		handleAuthExpired,
	};
}
