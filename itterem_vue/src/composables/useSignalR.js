import { ref, watch } from 'vue';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { useAuth } from './useAuth.js';
import { getApiBaseUrl } from '../utils.js';
import { SIGNALR_HUB_PATH } from '../constants.js';

// ---------------------------------------------------------------------------
// Module-level singleton — one WebSocket connection shared app-wide.
// ---------------------------------------------------------------------------

export const SIGNALR_CONNECTION_STATE = Object.freeze({
	DISCONNECTED: 'disconnected',
	CONNECTING: 'connecting',
	CONNECTED: 'connected',
	RECONNECTING: 'reconnecting',
});

export const SIGNALR_RECONNECT_DELAYS_MS = Object.freeze([0, 2000, 5000, 10000, 30000]);

const connectionState = ref(SIGNALR_CONNECTION_STATE.DISCONNECTED);

let connection = null;

// Registered callbacks per event name.
const listenersByEvent = new Map();
const dispatcherByEvent = new Map();

function getHubUrl() {
	const base = getApiBaseUrl().replace(/\/+$/, '');
	return `${base}${SIGNALR_HUB_PATH}`;
}

function buildConnection(token) {
	return new HubConnectionBuilder()
		.withUrl(getHubUrl(), {
			accessTokenFactory: () => token,
		})
		.withAutomaticReconnect(SIGNALR_RECONNECT_DELAYS_MS)
		.configureLogging(import.meta.env.DEV ? LogLevel.Information : LogLevel.Warning)
		.build();
}

function bindConnectionLifecycle(conn) {
	conn.onreconnecting(() => {
		connectionState.value = SIGNALR_CONNECTION_STATE.RECONNECTING;
	});
	conn.onreconnected(() => {
		connectionState.value = SIGNALR_CONNECTION_STATE.CONNECTED;
	});
	conn.onclose(() => {
		connectionState.value = SIGNALR_CONNECTION_STATE.DISCONNECTED;
	});
}


function createEventDispatcher(event) {
	return (...args) => {
		const listeners = listenersByEvent.get(event);
		if (!listeners) return;
		for (const callback of listeners) {
			try {
				callback(...args);
			} catch {
				// individual handler errors must not break other handlers
			}
		}
	};
}

function getOrCreateListeners(event) {
	let listeners = listenersByEvent.get(event);
	if (!listeners) {
		listeners = new Set();
		listenersByEvent.set(event, listeners);
	}
	return listeners;
}

function bindEventOnConnection(event, conn = connection) {
	if (!conn) return;
	let dispatcher = dispatcherByEvent.get(event);
	if (!dispatcher) {
		dispatcher = createEventDispatcher(event);
		dispatcherByEvent.set(event, dispatcher);
	}
	conn.off(event, dispatcher);
	conn.on(event, dispatcher);
}

function unbindEventFromConnection(event, conn = connection) {
	const dispatcher = dispatcherByEvent.get(event);
	if (!dispatcher) return;
	if (conn) conn.off(event, dispatcher);
	dispatcherByEvent.delete(event);
}

function bindRegisteredEvents(conn) {
	for (const event of listenersByEvent.keys()) {
		bindEventOnConnection(event, conn);
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
	bindConnectionLifecycle(connection);
	bindRegisteredEvents(connection);

	connectionState.value = SIGNALR_CONNECTION_STATE.CONNECTING;
	try {
		await connection.start();
		connectionState.value = SIGNALR_CONNECTION_STATE.CONNECTED;
	} catch {
		connectionState.value = SIGNALR_CONNECTION_STATE.DISCONNECTED;
	}
}

async function stop() {
	if (connection) {
		for (const event of dispatcherByEvent.keys()) {
			unbindEventFromConnection(event, connection);
		}
		try {
			await connection.stop();
		} catch {
			// ignore
		}
		connection = null;
	}
	connectionState.value = SIGNALR_CONNECTION_STATE.DISCONNECTED;
}

/**
 * Register a handler for a hub event (e.g. "OrderPlaced", "OrderUpdated").
 * Returns an unsubscribe function.
 */
function on(event, callback) {
	const listeners = getOrCreateListeners(event);
	listeners.add(callback);
	if (connection) bindEventOnConnection(event);

	return () => {
		const currentListeners = listenersByEvent.get(event);
		if (!currentListeners) return;
		currentListeners.delete(callback);
		if (currentListeners.size === 0) {
			listenersByEvent.delete(event);
			unbindEventFromConnection(event);
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
		SIGNALR_CONNECTION_STATE,
		start,
		stop,
		on,
	};
}
