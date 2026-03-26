let _isPhoneOrTabletCache = null;

function hasWindow() {
	return typeof window !== 'undefined';
}

function hasNavigator() {
	return typeof navigator !== 'undefined';
}

function hasCoarsePointer() {
	if (!hasWindow() || typeof window.matchMedia !== 'function') return false;
	try {
		return window.matchMedia('(pointer: coarse)').matches;
	} catch {
		return false;
	}
}

function getMaxTouchPoints() {
	if (!hasNavigator()) return 0;
	const raw = Number(navigator.maxTouchPoints ?? 0);
	return Number.isFinite(raw) ? raw : 0;
}

function isPhoneOrTabletByUserAgent() {
	if (!hasNavigator()) return false;
	const ua = String(navigator.userAgent ?? '');
	return /(Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet)/i.test(ua);
}

function isPhoneOrTabletByScreenProfile() {
	if (!hasWindow()) return false;
	const sw = Number(window.screen?.width ?? 0);
	const sh = Number(window.screen?.height ?? 0);
	if (!sw || !sh) return false;

	const shortest = Math.min(sw, sh);
	return shortest > 0 && shortest <= 900;
}

function detectPhoneOrTablet() {
	if (!hasWindow()) return false;

	if (isPhoneOrTabletByUserAgent()) return true;

	const coarsePointer = hasCoarsePointer();
	const touchPoints = getMaxTouchPoints();
	if (coarsePointer && touchPoints > 0 && isPhoneOrTabletByScreenProfile()) {
		return true;
	}

	return false;
}

export function isPhoneOrTabletDevice() {
	if (_isPhoneOrTabletCache == null) {
		_isPhoneOrTabletCache = detectPhoneOrTablet();
	}
	return _isPhoneOrTabletCache;
}

export function shouldPersistHeavyImageCache() {
	return !isPhoneOrTabletDevice();
}
