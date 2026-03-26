import { ORDER_STATUSES } from '../../config/constants.js';

export const ORDER_STATUS_PENDING = ORDER_STATUSES[0] ?? 'Függőben';
export const ORDER_STATUS_PROCESSING = ORDER_STATUSES[1] ?? 'Folyamatban';
export const ORDER_STATUS_READY = ORDER_STATUSES[2] ?? 'Átvehető';
export const ORDER_STATUS_DONE = ORDER_STATUSES[3] ?? 'Átvett';

const ORDER_ID_KEYS = Object.freeze(['id', 'Id']);
const ORDER_STATUS_KEYS = Object.freeze(['statusz', 'Statusz']);
const ORDER_ENTRIES_KEYS = Object.freeze(['rendelesElemeks', 'RendelesElemeks', 'items', 'Items']);
const ORDER_MESSAGE_KEYS = Object.freeze(['message', 'Message']);
const ORDER_CREATE_ID_KEYS = Object.freeze(['orderId', 'OrderId']);
const ORDER_USER_ID_KEYS = Object.freeze(['felhasznaloId', 'FelhasznaloId']);
const ORDER_USER_NAME_KEYS = Object.freeze(['teljesNev', 'TeljesNev', 'teljes_nev', 'Teljes_Nev', 'felhasznaloNev', 'FelhasznaloNev']);
const ORDER_USER_PHONE_KEYS = Object.freeze(['telefonszam', 'Telefonszam', 'telefonSzam', 'TelefonSzam', 'telefon', 'Telefon', 'phone', 'Phone']);
const ORDER_USER_OBJECT_KEYS = Object.freeze(['felhasznalo', 'Felhasznalo', 'user', 'User']);
const ORDER_TOTAL_KEYS = Object.freeze(['osszesAr', 'OsszesAr']);
const ORDER_DATE_KEYS = Object.freeze(['datum', 'Datum']);

const ENTRY_ID_KEYS = Object.freeze(['id', 'Id']);
const ENTRY_ORDER_ID_KEYS = Object.freeze(['rendelesId', 'RendelesId']);
const ENTRY_KESZETEL_ID_KEYS = Object.freeze(['keszetelId', 'KeszetelId']);
const ENTRY_UDITO_ID_KEYS = Object.freeze(['uditoId', 'UditoId']);
const ENTRY_MENU_ID_KEYS = Object.freeze(['menuId', 'MenuId']);
const ENTRY_KORET_ID_KEYS = Object.freeze(['koretId', 'KoretId']);
const ENTRY_KESZETEL_NEV_KEYS = Object.freeze(['keszetelNev', 'KeszetelNev']);
const ENTRY_UDITO_NEV_KEYS = Object.freeze(['uditoNev', 'UditoNev']);
const ENTRY_MENU_NEV_KEYS = Object.freeze(['menuNev', 'MenuNev']);
const ENTRY_KORET_NEV_KEYS = Object.freeze(['koretNev', 'KoretNev']);
const ENTRY_MENNYISEG_KEYS = Object.freeze(['mennyiseg', 'Mennyiseg']);

function readFirstDefined(source, keys) {
	if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
	for (const key of keys) {
		if (Object.hasOwn(source, key) && source[key] != null) return source[key];
	}
	return null;
}

function readOrderUserField(order, keys) {
	const direct = readFirstDefined(order, keys);
	if (direct != null) return direct;

	for (const userKey of ORDER_USER_OBJECT_KEYS) {
		const userObject = order?.[userKey];
		const nested = readFirstDefined(userObject, keys);
		if (nested != null) return nested;
	}

	return null;
}

export function toOrderId(value) {
	return String(value ?? '').trim();
}

export function readOrderId(order) {
	return readFirstDefined(order, ORDER_ID_KEYS);
}

export function readOrderIdFromPayload(payload) {
	return readOrderId(payload);
}

export function readOrderCreateId(payload) {
	return readFirstDefined(payload, ORDER_CREATE_ID_KEYS);
}

export function readOrderStatus(order) {
	return readFirstDefined(order, ORDER_STATUS_KEYS);
}

export function readOrderStatusFromPayload(payload) {
	return readOrderStatus(payload);
}

export function readOrderEntries(order) {
	return readFirstDefined(order, ORDER_ENTRIES_KEYS) ?? [];
}

export function readOrderMessage(payload) {
	return readFirstDefined(payload, ORDER_MESSAGE_KEYS);
}

export function readOrderUserId(order) {
	return readFirstDefined(order, ORDER_USER_ID_KEYS);
}

export function readOrderUserName(order) {
	return readOrderUserField(order, ORDER_USER_NAME_KEYS);
}

export function readOrderUserPhone(order) {
	return readOrderUserField(order, ORDER_USER_PHONE_KEYS);
}

export function readOrderTotal(order) {
	return readFirstDefined(order, ORDER_TOTAL_KEYS);
}

export function readOrderDate(order) {
	return readFirstDefined(order, ORDER_DATE_KEYS);
}

export function readOrderEntryId(entry) {
	return readFirstDefined(entry, ENTRY_ID_KEYS);
}

export function readOrderEntryOrderId(entry) {
	return readFirstDefined(entry, ENTRY_ORDER_ID_KEYS);
}

export function readOrderEntryKeszetelId(entry) {
	return readFirstDefined(entry, ENTRY_KESZETEL_ID_KEYS);
}

export function readOrderEntryUditoId(entry) {
	return readFirstDefined(entry, ENTRY_UDITO_ID_KEYS);
}

export function readOrderEntryMenuId(entry) {
	return readFirstDefined(entry, ENTRY_MENU_ID_KEYS);
}

export function readOrderEntryKoretId(entry) {
	return readFirstDefined(entry, ENTRY_KORET_ID_KEYS);
}

export function readOrderEntryKeszetelNev(entry) {
	return readFirstDefined(entry, ENTRY_KESZETEL_NEV_KEYS);
}

export function readOrderEntryUditoNev(entry) {
	return readFirstDefined(entry, ENTRY_UDITO_NEV_KEYS);
}

export function readOrderEntryMenuNev(entry) {
	return readFirstDefined(entry, ENTRY_MENU_NEV_KEYS);
}

export function readOrderEntryKoretNev(entry) {
	return readFirstDefined(entry, ENTRY_KORET_NEV_KEYS);
}

export function readOrderEntryMennyiseg(entry) {
	return readFirstDefined(entry, ENTRY_MENNYISEG_KEYS) ?? 0;
}
