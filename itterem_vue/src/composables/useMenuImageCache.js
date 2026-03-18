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
const INLINE_POINTER_PREFIX = 'cache-img:';
const INLINE_POINTER_URL_BASE = 'https://itterem.local/__inline-image-cache__/';

// In-memory set of kep keys known to be cached → avoids async cache lookups
// for already-fetched images during the same session.
const _known = shallowRef(/** @type {Set<string>} */ (new Set()));
const _inlineBlobUrlByPointer = new Map();
const _inlineResolutionVersion = shallowRef(0);
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

function isInlineDataImage(value) {
	return /^data:image\//i.test(String(value ?? '').trim());
}

function isInlineImagePointer(value) {
	return String(value ?? '').startsWith(INLINE_POINTER_PREFIX);
}

function pointerToCacheUrl(pointer) {
	const id = String(pointer ?? '').slice(INLINE_POINTER_PREFIX.length).trim();
	if (!id) return '';
	return `${INLINE_POINTER_URL_BASE}${id}`;
}

function simpleHash(value) {
	let hash = 0;
	for (let i = 0; i < value.length; i += 1) {
		hash = ((hash << 5) - hash) + value.charCodeAt(i);
		hash |= 0; // Keep as signed 32-bit integer.
	}
	return Math.abs(hash).toString(36);
}

function pointerFromInlineDataUrl(value) {
	const s = String(value ?? '').trim();
	if (!isInlineDataImage(s)) return '';
	const id = `${simpleHash(s)}-${s.length}`;
	return `${INLINE_POINTER_PREFIX}${id}`;
}

function collectInlinePointersFromDatasets(datasets) {
	const inlineToPersist = new Map(); // pointer -> data URL
	for (const dataset of datasets) {
		if (!Array.isArray(dataset)) continue;
		for (const item of dataset) {
			const kep = String(item?.kep ?? '').trim();
			if (!isInlineDataImage(kep)) continue;
			const pointer = pointerFromInlineDataUrl(kep);
			if (pointer) inlineToPersist.set(pointer, kep);
		}
	}
	return inlineToPersist;
}

async function dataUrlToResponse(dataUrl) {
	const response = await fetch(dataUrl);
	const blob = await response.blob();
	const contentType = blob.type || 'image/jpeg';
	return new Response(blob, {
		headers: { 'Content-Type': contentType },
	});
}

async function ensureInlinePointerCached(cache, pointer, dataUrl) {
	if (!pointer || !dataUrl) return;
	const cacheUrl = pointerToCacheUrl(pointer);
	if (!cacheUrl) return;
	if (_known.value.has(cacheUrl)) return;

	const existing = await cache.match(cacheUrl);
	if (existing) {
		_known.value = new Set([..._known.value, cacheUrl]);
		return;
	}

	const response = await dataUrlToResponse(dataUrl);
	await cache.put(cacheUrl, response);
	_known.value = new Set([..._known.value, cacheUrl]);
}

async function resolveInlinePointer(pointer) {
	if (!pointer) return '';
	if (_inlineBlobUrlByPointer.has(pointer)) {
		return _inlineBlobUrlByPointer.get(pointer) || '';
	}

	const cacheUrl = pointerToCacheUrl(pointer);
	if (!cacheUrl) return '';

	try {
		const cache = await caches.open(CACHE_NAME);
		const match = await cache.match(cacheUrl);
		if (!match) return '';
		const blob = await match.blob();
		const blobUrl = URL.createObjectURL(blob);
		_inlineBlobUrlByPointer.set(pointer, blobUrl);
		_inlineResolutionVersion.value += 1;
		return blobUrl;
	} catch {
		return '';
	}
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
	// Touch a reactive ref so views re-render when pointer URLs become available.
	void _inlineResolutionVersion.value;

	const k = String(kep ?? '').trim();
	if (!k) return '';

	if (isInlineImagePointer(k)) {
		const resolved = _inlineBlobUrlByPointer.get(k);
		if (resolved) return resolved;
		void resolveInlinePointer(k);
		return '';
	}

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

	const known = new Set(_known.value);

	// Collect image URLs that need fetching.
	const toFetch = new Map(); // url → kep
	const inlineToPersist = collectInlinePointersFromDatasets(datasets);
	for (const dataset of datasets) {
		if (!Array.isArray(dataset)) continue;
		for (const item of dataset) {
			const kep = String(item?.kep ?? '').trim();
			if (!kep) continue;

			if (isInlineDataImage(kep)) continue;

			if (isInlineImagePointer(kep)) continue;
			if (looksLikeInlineImage(kep)) continue;

			const url = toImageSrc(kep);
			if (!url || known.has(url)) continue;
			toFetch.set(url, kep);
		}
	}

	let cache;
	try {
		cache = await caches.open(CACHE_NAME);
	} catch {
		// Cache API unavailable – nothing we can do; images load from network.
		return;
	}

	if (inlineToPersist.size > 0) {
		await Promise.allSettled(
			[...inlineToPersist.entries()].map(async ([pointer, dataUrl]) => {
				await ensureInlinePointerCached(cache, pointer, dataUrl);
			}),
		);
	}

	if (toFetch.size === 0) return;

	const newKnown = new Set(known);

	// Concurrency limiter — process at most 6 fetches in parallel.
	const MAX_CONCURRENT = 6;
	const entries = [...toFetch.entries()];

	for (let i = 0; i < entries.length; i += MAX_CONCURRENT) {
		const batch = entries.slice(i, i + MAX_CONCURRENT);
		await Promise.allSettled(
			batch.map(async ([url]) => {
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
	}

	// Update the known-set shallowRef so any reactive consumer (if needed) can re-check.
	if (newKnown.size !== known.size) {
		_known.value = newKnown;
	}
}

/**
 * Ensure inline data:image payloads are written into Cache API under stable
 * pointer keys before localStorage serialization replaces them with pointers.
 *
 * @param {...Array} datasets
 * @returns {Promise<void>}
 */
export async function persistInlineImagesForDatasets(...datasets) {
	await initKnownKeys();
	const inlineToPersist = collectInlinePointersFromDatasets(datasets);
	if (inlineToPersist.size === 0) return;

	let cache;
	try {
		cache = await caches.open(CACHE_NAME);
	} catch {
		return;
	}

	await Promise.allSettled(
		[...inlineToPersist.entries()].map(async ([pointer, dataUrl]) => {
			await ensureInlinePointerCached(cache, pointer, dataUrl);
		}),
	);
}

/**
 * Convert inline base64 image refs in-memory into lightweight cache pointers.
 * Call before serializing data to localStorage.
 *
 * @param {string|null|undefined} value
 * @returns {string|null|undefined}
 */
export function toPersistentImageRef(value) {
	if (typeof value !== 'string') return value;
	const trimmed = value.trim();
	if (!trimmed) return '';
	if (isInlineImagePointer(trimmed)) return trimmed;
	if (!isInlineDataImage(trimmed)) return trimmed;
	const pointer = pointerFromInlineDataUrl(trimmed);
	return pointer || '';
}

/**
 * Resolve any cached image pointers found in datasets to displayable blob URLs.
 *
 * @param {...Array} datasets
 * @returns {Promise<void>}
 */
export async function resolveImagePointersForDatasets(...datasets) {
	await initKnownKeys();

	const pointers = new Set();
	for (const dataset of datasets) {
		if (!Array.isArray(dataset)) continue;
		for (const item of dataset) {
			const kep = String(item?.kep ?? '').trim();
			if (isInlineImagePointer(kep)) pointers.add(kep);
		}
	}

	if (pointers.size === 0) return;
	await Promise.allSettled([...pointers].map((pointer) => resolveInlinePointer(pointer)));
}
