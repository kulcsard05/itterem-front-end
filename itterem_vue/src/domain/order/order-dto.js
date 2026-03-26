import { asArray } from '../../shared/utils.js';
import {
	readOrderDate,
	readOrderEntries,
	readOrderEntryId,
	readOrderEntryKeszetelId,
	readOrderEntryKeszetelNev,
	readOrderEntryKoretId,
	readOrderEntryKoretNev,
	readOrderEntryMenuId,
	readOrderEntryMenuNev,
	readOrderEntryMennyiseg,
	readOrderEntryOrderId,
	readOrderEntryUditoId,
	readOrderEntryUditoNev,
	readOrderId,
	readOrderIdFromPayload,
	readOrderMessage,
	readOrderStatusFromPayload,
	readOrderTotal,
	readOrderUserName,
	readOrderUserPhone,
	readOrderUserId,
	ORDER_STATUS_PENDING,
} from './order-utils.js';

export function readText(value) {
	return String(value ?? '').trim();
}

export function normalizeOrderEntryDto(dto) {
	if (!dto || typeof dto !== 'object') return null;
	return {
		id: readOrderEntryId(dto),
		rendelesId: readOrderEntryOrderId(dto),
		keszetelId: readOrderEntryKeszetelId(dto),
		uditoId: readOrderEntryUditoId(dto),
		menuId: readOrderEntryMenuId(dto),
		koretId: readOrderEntryKoretId(dto),
		keszetelNev: readOrderEntryKeszetelNev(dto),
		uditoNev: readOrderEntryUditoNev(dto),
		menuNev: readOrderEntryMenuNev(dto),
		koretNev: readOrderEntryKoretNev(dto),
		mennyiseg: readOrderEntryMennyiseg(dto),
	};
}

export function normalizeOrderDto(dto) {
	if (!dto || typeof dto !== 'object') return null;
	const id = readOrderId(dto);
	if (id == null) return null;
	const entriesRaw = readOrderEntries(dto);
	const rendelesElemeks = asArray(entriesRaw)
		.map((e) => normalizeOrderEntryDto(e))
		.filter(Boolean);

	const status = readText(readOrderStatusFromPayload(dto));
	return {
		id,
		felhasznaloId: readOrderUserId(dto),
		teljesNev: readText(readOrderUserName(dto)),
		telefonszam: readText(readOrderUserPhone(dto)),
		osszesAr: readOrderTotal(dto),
		datum: readOrderDate(dto),
		statusz: status || ORDER_STATUS_PENDING,
		rendelesElemeks,
	};
}

export function extractOrderIdFromPayload(payload) {
	return readOrderIdFromPayload(payload);
}

export function extractOrderStatusFromPayload(payload) {
	return readText(readOrderStatusFromPayload(payload));
}

export function extractOrderUpdateEvent(args = []) {
	const [firstArg, secondArg, thirdArg] = asArray(args);
	const payload = firstArg && typeof firstArg === 'object' ? firstArg : null;

	const orderId = payload
		? extractOrderIdFromPayload(payload)
		: firstArg;

	const status = payload
		? extractOrderStatusFromPayload(payload)
		: readText(secondArg);

	const message = payload
		? readText(readOrderMessage(payload))
		: readText(thirdArg);

	return {
		orderId,
		status,
		message,
	};
}
