import { ref } from 'vue';
import { SERVER_URL_STORAGE_KEY } from '../constants.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = 7200;
const CONFIRM_TIMEOUT_MS = 4000;
const HELPER_HOST = import.meta.env.VITE_DISCOVERY_HELPER_HOST || '127.0.0.1';
const HELPER_PORT = Number(import.meta.env.VITE_DISCOVERY_HELPER_PORT || 41721);
const HELPER_BASE_URL = `http://${HELPER_HOST}:${HELPER_PORT}`;
const RESULT_POLL_MS = 500;
const DISCOVERY_TRIGGER = 'server-discovery-modal';
const ERROR_NO_SERVER = 'A helper nem talált használható szervert.';
const ERROR_HELPER_UNAVAILABLE = 'A discovery helper nem elérhető.';
const ERROR_DEV_ONLY = 'Ez a funkció csak fejlesztői módban érhető el.';
const ERROR_SCAN_FAILED = 'A keresés sikertelen volt.';
const ERROR_MANUAL_REJECTED = 'A megadott szerver nem lett elfogadva a helper által.';

// ---------------------------------------------------------------------------
// Persistence helpers (used outside composable too)
// ---------------------------------------------------------------------------

export function getPersistedServerUrl() {
	try {
		return localStorage.getItem(SERVER_URL_STORAGE_KEY) || null;
	} catch {
		return null;
	}
}

export function saveServerUrl(url) {
	const cleaned = String(url ?? '').replace(/\/+$/, '');
	try {
		localStorage.setItem(SERVER_URL_STORAGE_KEY, cleaned);
	} catch {
		// ignore storage failures
	}
	return cleaned;
}

export function clearPersistedServerUrl() {
	try {
		localStorage.removeItem(SERVER_URL_STORAGE_KEY);
	} catch {
		// ignore storage failures
	}
}

// ---------------------------------------------------------------------------
// Reachability check (used by App.vue on startup)
// ---------------------------------------------------------------------------

/**
 * Quick check: is the given base URL reachable on port 7200?
 * Uses mode:'no-cors' so CORS headers don't matter — resolves if TCP succeeds.
 */
export async function checkServerReachable(baseUrl) {
	if (!baseUrl) return false;
	const ac = new AbortController();
	const tid = setTimeout(() => ac.abort(), CONFIRM_TIMEOUT_MS);
	try {
		await fetch(`${baseUrl}/`, { mode: 'no-cors', signal: ac.signal });
		clearTimeout(tid);
		return true;
	} catch {
		clearTimeout(tid);
		return false;
	}
}

function helperUrl(path) {
	return `${HELPER_BASE_URL}${path}`;
}

async function helperFetch(path, options = {}) {
	const response = await fetch(helperUrl(path), options);
	const text = await response.text();
	let body = null;
	if (text) {
		try {
			body = JSON.parse(text);
		} catch {
			body = { raw: text };
		}
	}

	if (!response.ok) {
		const message = body?.error || body?.message || `HTTP ${response.status}`;
		throw new Error(message);
	}

	return body;
}

function readDiscoveredUrl(snapshot) {
	const overrideUrl = typeof snapshot?.overrideUrl === 'string' ? snapshot.overrideUrl.trim() : '';
	if (overrideUrl) return overrideUrl;
	const resultUrl = typeof snapshot?.result?.baseUrl === 'string' ? snapshot.result.baseUrl.trim() : '';
	return resultUrl || null;
}

function isDevMode() {
	return import.meta.env.DEV;
}

function normalizeBaseUrl(url) {
	return String(url ?? '').replace(/\/+$/, '');
}

function isAbortError(error) {
	return error?.name === 'AbortError';
}

function waitForPollTick(signal) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(resolve, RESULT_POLL_MS);
		signal.addEventListener(
			'abort',
			() => {
				clearTimeout(timer);
				reject(new DOMException('Aborted', 'AbortError'));
			},
			{ once: true },
		);
	});
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useServerDiscovery() {
	const scanning = ref(false);
	const scanned = ref(0);
	const total = ref(0);
	const discoveredUrl = ref(getPersistedServerUrl());
	const error = ref(null);

	let pollController = null;

	function applySnapshot(snapshot) {
		total.value = Number(snapshot?.progress?.total || 0);
		scanned.value = Number(snapshot?.progress?.scanned || 0);
		const currentUrl = readDiscoveredUrl(snapshot);
		if (currentUrl) {
			discoveredUrl.value = saveServerUrl(currentUrl);
		} else {
			discoveredUrl.value = null;
			clearPersistedServerUrl();
		}
		if (snapshot?.status === 'error') {
			error.value = snapshot?.error || ERROR_NO_SERVER;
		}
	}

	function resetScanProgress() {
		scanned.value = 0;
		total.value = 0;
	}

	function clearDiscoveredServer() {
		clearPersistedServerUrl();
		discoveredUrl.value = null;
		resetScanProgress();
	}

	function startScanState() {
		scanning.value = true;
		resetScanProgress();
		error.value = null;
		pollController = new AbortController();
	}

	function stopScanState() {
		scanning.value = false;
	}

	async function refreshState({ silent = false } = {}) {
		if (!isDevMode()) return;
		try {
			const snapshot = await helperFetch('/status');
			applySnapshot(snapshot);
		} catch (e) {
			if (!silent) {
				error.value = e.message || ERROR_HELPER_UNAVAILABLE;
			}
		}
	}

	async function scan() {
		if (scanning.value) return;

		if (!isDevMode()) {
			error.value = ERROR_DEV_ONLY;
			return;
		}

		startScanState();

		try {
			await helperFetch('/discover', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ trigger: DISCOVERY_TRIGGER }),
			});

			while (!pollController.signal.aborted) {
				const snapshot = await helperFetch('/result');
				applySnapshot(snapshot);

				if (snapshot?.status === 'found') return;
				if (snapshot?.status === 'error') return;

				await waitForPollTick(pollController.signal);
			}
		} catch (e) {
			if (isAbortError(e)) return;
			if (!pollController?.signal.aborted) {
				error.value = e.message || ERROR_SCAN_FAILED;
			}
		} finally {
			stopScanState();
		}
	}

	function stopScan() {
		pollController?.abort();
		stopScanState();
	}

	async function setManual(url) {
		error.value = null;
		await helperFetch('/override', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ baseUrl: normalizeBaseUrl(url) }),
		});
		await scan();
		if (!discoveredUrl.value) {
			throw new Error(ERROR_MANUAL_REJECTED);
		}
		return discoveredUrl.value;
	}

	async function clearServer() {
		error.value = null;
		stopScan();
		try {
			await helperFetch('/override', { method: 'DELETE' });
		} finally {
			clearDiscoveredServer();
		}
	}

	void refreshState({ silent: true });

	return {
		scanning,
		scanned,
		total,
		discoveredUrl,
		error,
		scan,
		stopScan,
		setManual,
		clearServer,
	};
}
