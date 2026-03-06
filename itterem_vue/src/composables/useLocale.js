import { computed, ref } from 'vue';
import {
	DEFAULT_LOCALE,
	SUPPORTED_LOCALES,
} from '../constants.js';
import { getStoredLocale, setStoredLocale } from '../storage-utils.js';
import { i18n, normalizeLocale } from '../i18n.js';

const locale = ref(normalizeLocale(getStoredLocale()) ?? DEFAULT_LOCALE);
i18n.global.locale.value = locale.value;

function applyLocale(nextLocale, { persist = true } = {}) {
	const resolved = normalizeLocale(nextLocale) ?? DEFAULT_LOCALE;
	locale.value = resolved;
	i18n.global.locale.value = resolved;
	if (persist) setStoredLocale(resolved);
	return resolved;
}

export function resolveLocalePreference(candidate) {
	return normalizeLocale(candidate) ?? normalizeLocale(getStoredLocale()) ?? DEFAULT_LOCALE;
}

export function setLocale(nextLocale, options) {
	return applyLocale(nextLocale, options);
}

export function getCurrentLocale() {
	return locale.value;
}

export function useLocale() {
	return {
		currentLocale: computed(() => locale.value),
		supportedLocales: SUPPORTED_LOCALES,
		setLocale: applyLocale,
	};
}
