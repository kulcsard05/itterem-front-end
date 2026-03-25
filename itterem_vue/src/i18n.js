import { createI18n } from 'vue-i18n';
import {
	DEFAULT_LOCALE,
	FALLBACK_LOCALE,
	SUPPORTED_LOCALES,
} from './config/constants.js';
import en from './locales/en.json';
import hu from './locales/hu.json';

const LOCALE_INTL_MAP = {
	hu: 'hu-HU',
	en: 'en-US',
};

export function normalizeLocale(value) {
	const candidate = Array.isArray(value) ? value[0] : value;
	const normalized = String(candidate ?? '').trim().toLowerCase();
	return SUPPORTED_LOCALES.includes(normalized) ? normalized : null;
}

export function getIntlLocale(locale) {
	return LOCALE_INTL_MAP[normalizeLocale(locale) ?? DEFAULT_LOCALE] ?? LOCALE_INTL_MAP[DEFAULT_LOCALE];
}

export const i18n = createI18n({
	legacy: false,
	locale: DEFAULT_LOCALE,
	fallbackLocale: FALLBACK_LOCALE,
	messages: {
		hu,
		en,
	},
});
