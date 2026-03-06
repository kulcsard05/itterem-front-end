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

// ---------------------------------------------------------------------------
// Persistence helpers (used outside composable too)
// ---------------------------------------------------------------------------

export function getPersistedServerUrl() {
	return localStorage.getItem(SERVER_URL_STORAGE_KEY) || null;
}

export function saveServerUrl(url) {
	const cleaned = String(url ?? '').replace(/\/+$/, '');
	localStorage.setItem(SERVER_URL_STORAGE_KEY, cleaned);
	return cleaned;
}

export function clearPersistedServerUrl() {
	localStorage.removeItem(SERVER_URL_STORAGE_KEY);
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
			error.value = snapshot?.error || 'A helper nem talált használható szervert.';
		}
	}

	async function refreshState({ silent = false } = {}) {
		if (!import.meta.env.DEV) return;
		try {
			const snapshot = await helperFetch('/status');
			applySnapshot(snapshot);
		} catch (e) {
			if (!silent) {
				error.value = e.message || 'A discovery helper nem elérhető.';
			}
		}
	}

	async function scan() {
		if (scanning.value) return;

		if (!import.meta.env.DEV) {
			error.value = 'Ez a funkció csak fejlesztői módban érhető el.';
			return;
		}

		scanning.value = true;
		scanned.value = 0;
		total.value = 0;
		error.value = null;
		pollController = new AbortController();

		try {
			await helperFetch('/discover', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ trigger: 'server-discovery-modal' }),
			});

			while (!pollController.signal.aborted) {
				const snapshot = await helperFetch('/result');
				applySnapshot(snapshot);

				if (snapshot?.status === 'found') return;
				if (snapshot?.status === 'error') return;

				await new Promise((resolve, reject) => {
					const timer = setTimeout(resolve, RESULT_POLL_MS);
					pollController.signal.addEventListener(
						'abort',
						() => {
							clearTimeout(timer);
							reject(new DOMException('Aborted', 'AbortError'));
						},
						{ once: true },
					);
				});
			}
		} catch (e) {
			if (e?.name === 'AbortError') return;
			if (!pollController?.signal.aborted) {
				error.value = e.message || 'A keresés sikertelen volt.';
			}
		} finally {
			scanning.value = false;
		}
	}

	function stopScan() {
		pollController?.abort();
		scanning.value = false;
	}

	async function setManual(url) {
		error.value = null;
		await helperFetch('/override', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ baseUrl: url.replace(/\/+$/, '') }),
		});
		await scan();
		if (!discoveredUrl.value) {
			throw new Error('A megadott szerver nem lett elfogadva a helper által.');
		}
		return discoveredUrl.value;
	}

	async function clearServer() {
		error.value = null;
		stopScan();
		try {
			await helperFetch('/override', { method: 'DELETE' });
		} finally {
			clearPersistedServerUrl();
			discoveredUrl.value = null;
			total.value = 0;
			scanned.value = 0;
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
