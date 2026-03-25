/**
 * Shared helpers for AdminDashboard entity configurations.
 * Reduces duplicated validation and payload-building logic across entities.
 */

import { asArray } from '../shared/utils.js';

// ---------------------------------------------------------------------------
// Validators — return an error string or null (valid).
// ---------------------------------------------------------------------------

/** Require a non-empty string for a named field. */
export function requiredName(form, key = 'nev', label = 'Név') {
	if (!String(form[key] ?? '').trim()) return `${label} kötelező.`;
	return null;
}

/** Require a valid price (non-negative integer). */
export function requiredPrice(form, key = 'ar') {
	const parsed = parsePrice(form[key]);
	if (parsed === null) return 'Érvényes ár kötelező (0 vagy nagyobb).';
	return null;
}

/** Require an image file during creation. */
export function requiredImageOnCreate(form, isCreate) {
	if (isCreate && !form.kepFile) return 'Kép feltöltése kötelező.';
	return null;
}

/** Require a non-empty select value. */
export function requiredSelect(form, key, label) {
	if (!String(form[key] ?? '').trim()) return `${label} kötelező.`;
	return null;
}

/** Require at least one non-empty select value among multiple keys. */
export function requiredAtLeastOneSelect(form, keys, label) {
	const keyList = asArray(keys);
	const hasAny = keyList.some((key) => String(form?.[key] ?? '').trim() !== '');
	const safeLabel = String(label ?? 'Mezők').trim() || 'Mezők';
	if (!hasAny) return `${safeLabel} közül legalább egy kötelező.`;
	return null;
}

/**
 * Chain multiple validators — returns the first error or null.
 * Each validator is called with (form, isCreate).
 */
export function validateAll(validators, form, isCreate) {
	for (const fn of validators) {
		const err = fn(form, isCreate);
		if (err) return err;
	}
	return null;
}

// ---------------------------------------------------------------------------
// Payload helpers
// ---------------------------------------------------------------------------

/** Parse a string/number into a non-negative integer, or null. */
export function parsePrice(value) {
	const raw = String(value ?? '').trim();
	if (!raw) return null;
	const parsed = Number(raw);
	return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

/** Parse a positive numeric bulk adjustment value, or null. */
export function parseBulkAdjustmentValue(value) {
	const raw = String(value ?? '').trim();
	if (!raw) return null;
	const parsed = Number(raw);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Convert a price value to a form-friendly display string. */
export function normalizePriceValue(value) {
	if (value == null || String(value).trim() === '') return '';
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return '';
	return String(Math.round(parsed));
}

/** Format a price for table display: "1 234 Ft". */
export function formatPrice(value) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return '-';
	return `${parsed.toLocaleString('hu-HU')} Ft`;
}

/** Apply a bulk price adjustment and clamp the result to 0 Ft. */
export function applyBulkPriceAdjustment(currentPrice, { mode, value }) {
	const base = Number(currentPrice);
	const amount = parseBulkAdjustmentValue(value);
	if (!Number.isFinite(base) || amount === null) return null;

	let nextPrice = base;
	if (mode === 'increase-amount') nextPrice = base + amount;
	else if (mode === 'decrease-amount') nextPrice = base - amount;
	else if (mode === 'increase-percent') nextPrice = base * (1 + amount / 100);
	else if (mode === 'decrease-percent') nextPrice = base * (1 - amount / 100);
	else return null;

	return Math.max(0, Math.round(nextPrice));
}

/** Normalize an "available" boolean/number to true/false. */
export function normalizeAvailable(value) {
	return value === 1 || value === true;
}

/** Normalize a select value: null/undefined → '', otherwise String(). */
export function normalizeSelectValue(value) {
	return value == null ? '' : String(value);
}

/**
 * Build the "elerheto" field from form data.
 * Coerces the form value to 1 or 0.
 */
export function buildElerheto(form) {
	return String(form.elerheto ?? '0') === '1' ? 1 : 0;
}

/**
 * Build common payload fields for entities that have name, availability, price, and image.
 */
export function buildBasePayload(form, { includeDescription = false } = {}) {
	const base = {
		nev: String(form.nev ?? '').trim(),
		elerheto: buildElerheto(form),
		ar: parsePrice(form.ar),
		kepFile: form.kepFile ?? null,
	};
	if (includeDescription) {
		base.leiras = String(form.leiras ?? '').trim();
	}
	return base;
}

/**
 * Build <select> option objects from an entity list.
 * Default shape assumes { id, nev }.
 */
export function buildSelectOptions(
	list,
	{ valueKey = 'id', labelKey = 'nev', valueCast = (v) => String(v) } = {},
) {
	const items = asArray(list);
	return items
		.map((item) => {
			const value = item?.[valueKey];
			const label = item?.[labelKey];
			if (value == null) return null;
			return { value: valueCast(value), label: String(label ?? '').trim() };
		})
		.filter(Boolean);
}
