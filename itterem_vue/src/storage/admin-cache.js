import { asArray } from '../utils.js';
import { readStorageJson, writeStorageJson } from '../storage-utils.js';

const ADMIN_CACHE_VERSION = 'v1';
const ADMIN_CACHE_PREFIX = `admin-cache-${ADMIN_CACHE_VERSION}`;

function getDatasetCacheKey(label) {
	return `${ADMIN_CACHE_PREFIX}:${String(label ?? '').trim().toLowerCase()}`;
}

export function readAdminDatasetCache(label) {
	const cacheKey = getDatasetCacheKey(label);
	const payload = readStorageJson(cacheKey, { fallback: null });
	if (!payload || typeof payload !== 'object') return null;
	if (!Array.isArray(payload.items)) return null;

	const updatedAt = Number(payload.updatedAt);
	return {
		items: asArray(payload.items),
		updatedAt: Number.isFinite(updatedAt) ? updatedAt : null,
	};
}

export function writeAdminDatasetCache(label, items) {
	const cacheKey = getDatasetCacheKey(label);
	return writeStorageJson(
		cacheKey,
		{
			updatedAt: Date.now(),
			items: asArray(items),
		},
		{ context: '[AdminCache]' },
	);
}
