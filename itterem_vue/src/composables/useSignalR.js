import { ref, watch } from 'vue';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { useAuth } from './useAuth.js';
import { getApiBaseUrl } from '../utils.js';
import { SIGNALR_HUB_PATH } from '../constants.js';

// ---------------------------------------------------------------------------
// Module-level singleton — one WebSocket connection shared app-wide.
// ---------------------------------------------------------------------------

const connectionState = ref('disconnected'); // disconnected | connecting | connected | reconnecting

let connection = null;
let started = false;

// Registered callbacks per event name.
const listeners = {};

function getHubUrl() {
	const base = getApiBaseUrl().replace(/\/+$/, '');
	return `${base}${SIGNALR_HUB_PATH}`;
}

function buildConnection(token) {
	return new HubConnectionBuilder()
		.withUrl(getHubUrl(), {
			accessTokenFactory: () => token,
		})
		.withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
		.configureLogging(import.meta.env.DEV ? LogLevel.Information : LogLevel.Warning)
		.build();
}

// Track which event names have been bound on the current connection
// to prevent re-registering the same dispatcher on reconnect.
let boundEvents = new Set();

function bindEvents(conn) {
	conn.onreconnecting(() => {
		connectionState.value = 'reconnecting';
	});
	conn.onreconnected(() => {
		connectionState.value = 'connected';
	});
	conn.onclose(() => {
		connectionState.value = 'disconnected';
		started = false;
	});

	// Re-register all currently-known event listeners on the new connection,
	// but only if not already bound (prevents duplicate dispatchers).
	for (const [event, callbacks] of Object.entries(listeners)) {
		if (boundEvents.has(event)) continue;
		boundEvents.add(event);
		conn.on(event, (...args) => {
			for (const cb of (listeners[event] || [])) {
				try {
					cb(...args);
				} catch {
					// individual handler errors must not break other handlers
				}
			}
		});
	}
}

async function start() {
	const { auth } = useAuth();
	const token = auth.value?.token;
	if (!token) return;

	// Already connected with a live connection — nothing to do.
	if (connection && connection.state === HubConnectionState.Connected) return;

	await stop();

	connection = buildConnection(token);
	bindEvents(connection);

	connectionState.value = 'connecting';
	try {
		await connection.start();
		connectionState.value = 'connected';
		started = true;
	} catch {
		connectionState.value = 'disconnected';
		started = false;
	}
}

async function stop() {
	started = false;
	boundEvents = new Set();
	if (connection) {
		try {
			await connection.stop();
		} catch {
			// ignore
		}
		connection = null;
	}
	connectionState.value = 'disconnected';
}

/**
 * Register a handler for a hub event (e.g. "OrderPlaced", "OrderUpdated").
 * Returns an unsubscribe function.
 */
function on(event, callback) {
	if (!listeners[event]) listeners[event] = [];
	listeners[event].push(callback);

	// If a connection already exists and this event hasn't been bound yet,
	// register a single dispatcher that iterates the listeners array.
	if (connection && !boundEvents.has(event)) {
		boundEvents.add(event);
		connection.on(event, (...args) => {
			for (const cb of (listeners[event] || [])) {
				try {
					cb(...args);
				} catch {
					// ignore
				}
			}
		});
	}

	return () => {
		const arr = listeners[event];
		if (!arr) return;
		const idx = arr.indexOf(callback);
		if (idx !== -1) arr.splice(idx, 1);
		if (arr.length === 0) {
			delete listeners[event];
			boundEvents.delete(event);
			if (connection) connection.off(event);
		}
	};
}

// ---------------------------------------------------------------------------
// Auto-manage connection on auth changes.
// ---------------------------------------------------------------------------
let watcherSetUp = false;

function ensureAuthWatcher() {
	if (watcherSetUp) return;
	watcherSetUp = true;
	const { auth } = useAuth();
	watch(
		() => auth.value?.token,
		(newToken, oldToken) => {
			if (newToken && newToken !== oldToken) {
				start();
			} else if (!newToken) {
				stop();
			}
		},
	);
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useSignalR() {
	ensureAuthWatcher();

	return {
		connectionState,
		start,
		stop,
		on,
	};
}
