import { MENU_ETAG_STORAGE_KEY } from '../constants.js';

export function readMenuEtags() {
	try {
		const raw = localStorage.getItem(MENU_ETAG_STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

export function writeMenuEtags(etags) {
	try {
		localStorage.setItem(MENU_ETAG_STORAGE_KEY, JSON.stringify(etags || {}));
	} catch {
		// ignore storage failures
	}
}

export function writeMenuEtag(key, value) {
	if (!key || !value) return;
	const etags = readMenuEtags();
	etags[key] = value;
	writeMenuEtags(etags);
}

export function deleteMenuEtag(key) {
	if (!key) return;
	const etags = readMenuEtags();
	if (!(key in etags)) return;
	delete etags[key];
	writeMenuEtags(etags);
}

export function dropMenuEtags(keys) {
	if (!Array.isArray(keys) || keys.length === 0) return;
	const etags = readMenuEtags();
	let changed = false;
	for (const key of keys) {
		if (key in etags) {
			delete etags[key];
			changed = true;
		}
	}
	if (changed) writeMenuEtags(etags);
}
