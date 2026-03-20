import { asArray } from './utils.js';

export function readText(value) {
	return String(value ?? '').trim();
}

export function normalizeOrderEntryDto(dto) {
	if (!dto || typeof dto !== 'object') return null;
	return {
		id: dto?.id ?? dto?.Id ?? null,
		rendelesId: dto?.rendelesId ?? dto?.RendelesId ?? null,
		keszetelId: dto?.keszetelId ?? dto?.KeszetelId ?? null,
		uditoId: dto?.uditoId ?? dto?.UditoId ?? null,
		menuId: dto?.menuId ?? dto?.MenuId ?? null,
		koretId: dto?.koretId ?? dto?.KoretId ?? null,
		keszetelNev: dto?.keszetelNev ?? dto?.KeszetelNev ?? null,
		uditoNev: dto?.uditoNev ?? dto?.UditoNev ?? null,
		menuNev: dto?.menuNev ?? dto?.MenuNev ?? null,
		koretNev: dto?.koretNev ?? dto?.KoretNev ?? null,
		mennyiseg: dto?.mennyiseg ?? dto?.Mennyiseg ?? 0,
	};
}

export function normalizeOrderDto(dto) {
	if (!dto || typeof dto !== 'object') return null;
	const id = dto?.id ?? dto?.Id ?? null;
	if (id == null) return null;
	const entriesRaw = dto?.rendelesElemeks ?? dto?.RendelesElemeks ?? dto?.rendelesElemek ?? dto?.RendelesElemek ?? [];
	const rendelesElemeks = asArray(entriesRaw)
		.map((e) => normalizeOrderEntryDto(e))
		.filter(Boolean);

	const status = readText(dto?.statusz ?? dto?.Statusz ?? dto?.status ?? dto?.Status);
	return {
		id,
		felhasznaloId: dto?.felhasznaloId ?? dto?.FelhasznaloId ?? null,
		osszesAr: dto?.osszesAr ?? dto?.OsszesAr ?? null,
		datum: dto?.datum ?? dto?.Datum ?? null,
		statusz: status || 'Függőben',
		rendelesElemeks,
	};
}

export function extractOrderIdFromPayload(payload) {
	return payload?.id ?? payload?.Id ?? payload?.orderId ?? payload?.OrderId ?? payload?.order?.id ?? payload?.order?.Id ?? null;
}

export function extractOrderStatusFromPayload(payload) {
	return readText(
		payload?.statusz ?? payload?.Statusz ?? payload?.status ?? payload?.Status ?? payload?.order?.statusz ?? payload?.order?.Statusz ?? payload?.order?.status ?? payload?.order?.Status,
	);
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
		? readText(payload?.message ?? payload?.Message ?? payload?.uzenet ?? payload?.Uzenet)
		: readText(thirdArg);

	return {
		orderId,
		status,
		message,
	};
}
