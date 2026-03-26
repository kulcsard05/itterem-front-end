import { shallowRef } from 'vue';
import { MENU_IMAGES_STORAGE_KEY } from '../config/constants.js';
import { toImageSrc } from '../shared/utils.js';
import { shouldPersistHeavyImageCache } from './useDeviceClass.js';

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

function isLikelyNetworkImageRef(value) {
	const s = String(value ?? '').trim();
	if (!s) return false;
	if (s.startsWith('data:') || s.startsWith('blob:')) return false;
	if (isInlineImagePointer(s)) return false;
	if (looksLikeInlineImage(s)) return false;
	return true;
}

function sanitizeStoredImageRef(value, maxLength = 1024) {
	const s = String(value ?? '').trim();
	if (!s) return '';
	if (s.length > maxLength) return '';
	return s;
}

function toNormalizedCacheUrl(value) {
	const s = String(value ?? '').trim();
	if (!s) return '';
	if (typeof window === 'undefined' || !window.location?.origin) return s;
	try {
		return new URL(s, window.location.origin).href;
	} catch {
		return s;
	}
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
export function getImageSrc(kep, options = {}) {
	// Touch a reactive ref so views re-render when pointer URLs become available.
	void _inlineResolutionVersion.value;
	const original = sanitizeStoredImageRef(options?.original ?? '', 1024);

	const k = String(kep ?? '').trim();
	if (!k) return original ? toImageSrc(original) : '';

	if (isInlineImagePointer(k)) {
		const resolved = _inlineBlobUrlByPointer.get(k);
		if (resolved) return resolved;
		void resolveInlinePointer(k);
		return original ? toImageSrc(original) : '';
	}

	return toImageSrc(k);
}

/**
 * Convert image refs into cache-safe persisted fields.
 *
 * - `kep` stays the primary source, possibly pointerized (`cache-img:*`).
 * - `kepOriginal` is only kept when it is a short URL/path-style ref.
 *
 * @param {string|null|undefined} value
 * @param {{ fallbackOriginal?: string|null|undefined }} [options]
 * @returns {{ kep: string, kepOriginal: string }}
 */
export function toPersistentImageRefs(value, options = {}) {
	const raw = String(value ?? '').trim();
	const canPersistHeavyCache = shouldPersistHeavyImageCache();
	let persistedPrimary = sanitizeStoredImageRef(toPersistentImageRef(raw), 1024);

	const candidates = [raw, String(options.fallbackOriginal ?? '').trim()];
	let kepOriginal = '';
	for (const candidate of candidates) {
		if (!candidate) continue;
		if (!isLikelyNetworkImageRef(candidate)) continue;
		kepOriginal = sanitizeStoredImageRef(candidate, 1024);
		if (kepOriginal) break;
	}

	if (!canPersistHeavyCache && isInlineImagePointer(persistedPrimary)) {
		persistedPrimary = kepOriginal || '';
	}

	return {
		kep: persistedPrimary,
		kepOriginal,
	};
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
	if (!shouldPersistHeavyImageCache()) return;

	// Ensure we know what's already cached.
	await initKnownKeys();

	const known = new Set(_known.value);

	// Collect image URLs that need fetching.
	const toFetch = new Map(); // url → kep
	const pointerFallbacks = new Map(); // pointer -> fallback URL
	const inlineToPersist = collectInlinePointersFromDatasets(datasets);
	for (const dataset of datasets) {
		if (!Array.isArray(dataset)) continue;
		for (const item of dataset) {
			const kep = String(item?.kep ?? '').trim();
			const kepOriginal = String(item?.kepOriginal ?? '').trim();
			if (!kep) continue;

			if (isInlineDataImage(kep)) continue;

			if (isInlineImagePointer(kep)) {
				const pointerCacheUrl = pointerToCacheUrl(kep);
				if (!pointerCacheUrl || known.has(pointerCacheUrl)) continue;

				const fallback = isLikelyNetworkImageRef(kepOriginal)
					? toImageSrc(kepOriginal)
					: '';
				if (fallback) pointerFallbacks.set(kep, fallback);
				continue;
			}
			if (looksLikeInlineImage(kep)) continue;

			const url = toImageSrc(kep);
			const knownKey = toNormalizedCacheUrl(url);
			if (!url || (knownKey && known.has(knownKey))) continue;
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

	if (toFetch.size === 0 && pointerFallbacks.size === 0) return;

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
					const knownKey = toNormalizedCacheUrl(url);
					if (knownKey) newKnown.add(knownKey);
				} catch {
					// Network error or CORS block – image skipped.
				}
			}),
		);
	}

	const pointerEntries = [...pointerFallbacks.entries()];
	for (let i = 0; i < pointerEntries.length; i += MAX_CONCURRENT) {
		const batch = pointerEntries.slice(i, i + MAX_CONCURRENT);
		await Promise.allSettled(
			batch.map(async ([pointer, fallbackUrl]) => {
				const cacheUrl = pointerToCacheUrl(pointer);
				if (!cacheUrl) return;
				const fallbackKnownKey = toNormalizedCacheUrl(fallbackUrl);
				try {
					const response = await fetch(fallbackUrl);
					if (!response.ok) return;

					// Keep both keys warm: stable pointer key and direct URL key.
					await cache.put(cacheUrl, response.clone());
					await cache.put(fallbackUrl, response);
					newKnown.add(cacheUrl);
					if (fallbackKnownKey) newKnown.add(fallbackKnownKey);
				} catch {
					// Network error or CORS block – pointer cache fill skipped.
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
	if (!shouldPersistHeavyImageCache()) return;

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
	const unresolvedDatasetIndexes = new Set();
	const pointersByDatasetIndex = new Map();
	for (const dataset of datasets) {
		const datasetIndex = pointersByDatasetIndex.size;
		if (!Array.isArray(dataset)) {
			pointersByDatasetIndex.set(datasetIndex, new Set());
			continue;
		}

		const datasetPointers = new Set();
		for (const item of dataset) {
			const kep = String(item?.kep ?? '').trim();
			if (!isInlineImagePointer(kep)) continue;
			pointers.add(kep);
			datasetPointers.add(kep);
		}
		pointersByDatasetIndex.set(datasetIndex, datasetPointers);
	}

	if (pointers.size === 0) {
		return {
			totalPointers: 0,
			resolvedPointers: 0,
			unresolvedPointers: [],
			unresolvedDatasetIndexes: [],
		};
	}

	await Promise.allSettled([...pointers].map((pointer) => resolveInlinePointer(pointer)));

	let unresolvedPointers = [...pointers].filter((pointer) => !_inlineBlobUrlByPointer.get(pointer));

	if (unresolvedPointers.length > 0) {
		// Recovery attempt: refill cache entries (desktop only) and retry pointer resolves.
		await cacheImagesForDatasets(...datasets);
		await Promise.allSettled(unresolvedPointers.map((pointer) => resolveInlinePointer(pointer)));
		unresolvedPointers = unresolvedPointers.filter((pointer) => !_inlineBlobUrlByPointer.get(pointer));
	}

	if (unresolvedPointers.length > 0) {
		const unresolvedSet = new Set(unresolvedPointers);
		for (const [index, datasetPointers] of pointersByDatasetIndex.entries()) {
			for (const pointer of datasetPointers) {
				if (unresolvedSet.has(pointer)) {
					unresolvedDatasetIndexes.add(index);
					break;
				}
			}
		}
	}

	return {
		totalPointers: pointers.size,
		resolvedPointers: pointers.size - unresolvedPointers.length,
		unresolvedPointers,
		unresolvedDatasetIndexes: [...unresolvedDatasetIndexes],
	};
}
