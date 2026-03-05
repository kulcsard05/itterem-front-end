import { shallowRef } from 'vue';
import { MENU_IMAGES_STORAGE_KEY } from '../constants.js';
import { toImageSrc } from '../utils.js';

// ---------------------------------------------------------------------------
// Cache API-based image cache (replaces the old localStorage approach).
//
// Images are stored as real HTTP Response objects in the Cache API which uses
// the browser's disk cache – no practical size limit and no QuotaExceededError.
// ---------------------------------------------------------------------------

const CACHE_NAME = 'itterem-images-v1';

// In-memory set of kep keys known to be cached → avoids async cache lookups
// for already-fetched images during the same session.
const _known = shallowRef(/** @type {Set<string>} */ (new Set()));
let _initialised = false;

/**
 * One-time migration: remove the old base64 localStorage blob that used to
 * store all images and was the primary cause of QuotaExceededError.
 */
function migrateOldImageCache() {
	try {
		localStorage.removeItem(MENU_IMAGES_STORAGE_KEY);
	} catch {
		// ignore
	}
}

async function initKnownKeys() {
	if (_initialised) return;
	_initialised = true;
	migrateOldImageCache();
	try {
		const cache = await caches.open(CACHE_NAME);
		const keys = await cache.keys();
		const set = new Set();
		for (const req of keys) {
			// We store items under their toImageSrc() URL; extract the last
			// path segment as the kep key is typically embedded in the URL.
			set.add(req.url);
		}
		_known.value = set;
	} catch {
		// Cache API unavailable (e.g. some privacy modes) – images will load from network.
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function looksLikeInlineImage(value) {
	const s = String(value ?? '').trim();
	if (!s) return false;
	if (s.startsWith('data:') || s.startsWith('blob:')) return true;
	// Bare base64: long, no whitespace, only base64 characters.
	return s.length >= 40 && !/\s/.test(s) && /^[A-Za-z0-9+/=]+$/.test(s);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve an item's kep field to a displayable src string.
 *
 * Always returns the server URL via toImageSrc(). The Cache API transparently
 * serves previously-cached responses when the browser fetches the URL, so
 * images load instantly from disk even when offline.
 *
 * @param {string|null|undefined} kep  Raw kep value from a menu item.
 * @returns {string}
 */
export function getImageSrc(kep) {
	const k = String(kep ?? '').trim();
	if (!k) return '';
	return toImageSrc(k);
}

/**
 * Fetch and cache images for all items in the given datasets.
 *
 * - Skips items whose kep is already inline (data:, blob:, base64).
 * - Skips items already present in the Cache API.
 * - Fetches all new images in parallel; stores Responses in Cache API.
 *
 * This is fine to call without await – images download in the background.
 *
 * @param {...Array} datasets  One or more arrays of menu item objects with a `kep` field.
 * @returns {Promise<void>}
 */
export async function cacheImagesForDatasets(...datasets) {
	// Ensure we know what's already cached.
	await initKnownKeys();

	const known = _known.value;

	// Collect image URLs that need fetching.
	const toFetch = new Map(); // url → kep
	for (const dataset of datasets) {
		if (!Array.isArray(dataset)) continue;
		for (const item of dataset) {
			const kep = String(item?.kep ?? '').trim();
			if (!kep || looksLikeInlineImage(kep)) continue;
			const url = toImageSrc(kep);
			if (!url || known.has(url)) continue;
			toFetch.set(url, kep);
		}
	}

	if (toFetch.size === 0) return;

	let cache;
	try {
		cache = await caches.open(CACHE_NAME);
	} catch {
		// Cache API unavailable – nothing we can do; images load from network.
		return;
	}

	const newKnown = new Set(known);

	await Promise.allSettled(
		[...toFetch.entries()].map(async ([url]) => {
			try {
				const resp = await fetch(url);
				if (!resp.ok) return;
				await cache.put(url, resp);
				newKnown.add(url);
			} catch {
				// Network error or CORS block – image skipped.
			}
		}),
	);

	// Update the known-set shallowRef so any reactive consumer (if needed) can re-check.
	if (newKnown.size !== known.size) {
		_known.value = newKnown;
	}
}
