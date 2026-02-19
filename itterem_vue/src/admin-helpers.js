/**
 * Shared helpers for AdminDashboard entity configurations.
 * Reduces duplicated validation and payload-building logic across entities.
 */

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
	if (!Number.isFinite(parsed) || parsed < 0) return null;
	return Math.round(parsed);
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

/** Normalize an "available" boolean/number to true/false. */
export function normalizeAvailable(value) {
	return value === 1 || value === true;
}

/** Normalize a select value: null/undefined → '', otherwise String(). */
export function normalizeSelectValue(value) {
	if (value === null || value === undefined) return '';
	return String(value);
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
