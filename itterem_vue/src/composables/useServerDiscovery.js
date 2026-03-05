import { ref } from 'vue';
import { SERVER_URL_STORAGE_KEY } from '../constants.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = 7200;
const PROBE_TIMEOUT_MS = 500;   // per-host TCP probe timeout
const CONFIRM_TIMEOUT_MS = 4000; // full confirmation fetch timeout
const BATCH_SIZE = 30;           // concurrent probes per round

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

// ---------------------------------------------------------------------------
// Subnet detection via WebRTC
// ---------------------------------------------------------------------------

/**
 * Derive the local /24 subnet prefix (e.g. "192.168.40") from the browser's
 * local ICE candidate IP using an RTCPeerConnection data channel.
 * Returns null if detection fails or times out.
 */
function detectLocalSubnet() {
	return new Promise((resolve) => {
		try {
			const pc = new RTCPeerConnection({ iceServers: [] });
			pc.createDataChannel('');
			pc.createOffer()
				.then((offer) => pc.setLocalDescription(offer))
				.catch(() => resolve(null));

			pc.onicecandidate = (e) => {
				if (!e.candidate) return;
				const m = /(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}/.exec(
					e.candidate.candidate ?? '',
				);
				if (m) {
					resolve(m[1]); // e.g. "192.168.40"
					pc.close();
				}
			};

			// Give ICE gathering up to 2 s.
			setTimeout(() => resolve(null), 2000);
		} catch {
			resolve(null);
		}
	});
}

// ---------------------------------------------------------------------------
// Port probing
// ---------------------------------------------------------------------------

/**
 * Check if http://{ip}:{PORT}/ responds to a TCP connection.
 * mode:'no-cors' means the fetch resolves with an opaque response for any
 * HTTP reply, and rejects only on network failure (refused / timeout / DNS).
 */
async function probeHost(ip, outerSignal) {
	const ac = new AbortController();
	const tid = setTimeout(() => ac.abort(), PROBE_TIMEOUT_MS);
	outerSignal?.addEventListener('abort', () => ac.abort(), { once: true });
	try {
		await fetch(`http://${ip}:${PORT}/`, { mode: 'no-cors', signal: ac.signal });
		clearTimeout(tid);
		return true;
	} catch {
		clearTimeout(tid);
		return false;
	}
}

/**
 * Scan all 254 host addresses in the given /24 subnet in parallel batches.
 * Stops as soon as the first open host is found.
 * @param {string}   subnet     e.g. "192.168.40"
 * @param {Function} onProbed   called after each host attempt (for progress)
 * @param {AbortSignal} signal  cancel the scan
 * @returns {Promise<string|null>} first IP with port open, or null
 */
async function scanSubnet(subnet, onProbed, signal) {
	for (let start = 1; start <= 254; start += BATCH_SIZE) {
		if (signal?.aborted) break;

		const batch = [];
		for (let i = start; i < start + BATCH_SIZE && i <= 254; i++) {
			batch.push(`${subnet}.${i}`);
		}

		const results = await Promise.all(
			batch.map(async (ip) => {
				const open = await probeHost(ip, signal);
				onProbed?.();
				return open ? ip : null;
			}),
		);

		const found = results.find((ip) => ip !== null);
		if (found) return found;
	}
	return null;
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useServerDiscovery() {
	const scanning = ref(false);
	const scanned = ref(0);   // hosts probed so far
	const total = ref(254);   // total hosts in the subnet
	const discoveredUrl = ref(getPersistedServerUrl());
	const error = ref(null);

	let abortController = null;

	async function scan() {
		if (scanning.value) return;

		scanning.value = true;
		scanned.value = 0;
		total.value = 254;
		error.value = null;
		abortController = new AbortController();

		try {
			// 1. Detect the local /24 subnet via WebRTC.
			const subnet = await detectLocalSubnet();
			if (!subnet) {
				error.value = 'Nem sikerült meghatározni a helyi alhálózatot. Próbáld manuálisan.';
				return;
			}

			// 2. Scan the subnet for an open port 7200.
			const ip = await scanSubnet(
				subnet,
				() => { scanned.value++; },
				abortController.signal,
			);

			if (abortController.signal.aborted) return;

			if (!ip) {
				error.value = `Nem található szerver a(z) ${subnet}.0/24 hálózaton (port ${PORT}).`;
				return;
			}

			// 3. Save the discovered URL.
			const baseUrl = `http://${ip}:${PORT}`;
			const saved = saveServerUrl(baseUrl);
			discoveredUrl.value = saved;
		} catch (e) {
			if (!abortController?.signal.aborted) {
				error.value = e.message || 'A keresés sikertelen volt.';
			}
		} finally {
			scanning.value = false;
		}
	}

	function stopScan() {
		abortController?.abort();
		scanning.value = false;
	}

	function setManual(url) {
		const saved = saveServerUrl(url);
		discoveredUrl.value = saved;
		error.value = null;
	}

	function clearServer() {
		clearPersistedServerUrl();
		discoveredUrl.value = null;
	}

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
