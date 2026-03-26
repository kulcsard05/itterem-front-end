import { reactive, ref, onScopeDispose } from 'vue';
import { readStorageJson, writeStorageJson } from '../storage/storage-utils.js';

export function useFloatingPanel({
	prefsKey,
	minWidth,
	minHeight,
	defaultWidth,
	defaultHeight,
	fontMin,
	fontMax,
}) {
	const panelX = ref(24);
	const panelY = ref(24);
	const panelW = ref(defaultWidth);
	const panelH = ref(defaultHeight);
	const panelRef = ref(null);
	const detailFontSize = ref(16);

	let _savePanelPrefsTimer = null;
	let _hasViewportListeners = false;

	function clamp(value, min, max) {
		if (!Number.isFinite(value)) return min;
		if (!Number.isFinite(min)) return value;
		if (!Number.isFinite(max)) return Math.max(min, value);
		return Math.min(max, Math.max(min, value));
	}

	function getViewportSize() {
		try {
			const width = Math.max(1, Math.floor(window.innerWidth || 0));
			const height = Math.max(1, Math.floor(window.innerHeight || 0));
			return { width, height };
		} catch {
			return { width: Math.max(1, defaultWidth), height: Math.max(1, defaultHeight) };
		}
	}

	function clampPanelSize(width, height) {
		const viewport = getViewportSize();
		const effectiveMinWidth = Math.min(minWidth, viewport.width);
		const effectiveMinHeight = Math.min(minHeight, viewport.height);
		return {
			width: clamp(Math.round(width), effectiveMinWidth, viewport.width),
			height: clamp(Math.round(height), effectiveMinHeight, viewport.height),
		};
	}

	function clampPanelPosition(x, y, width, height) {
		const viewport = getViewportSize();
		const maxX = Math.max(0, viewport.width - width);
		const maxY = Math.max(0, viewport.height - height);
		return {
			x: clamp(Math.round(x), 0, maxX),
			y: clamp(Math.round(y), 0, maxY),
		};
	}

	function applyViewportConstraints({ persist = false } = {}) {
		const nextSize = clampPanelSize(panelW.value, panelH.value);
		panelW.value = nextSize.width;
		panelH.value = nextSize.height;

		const nextPos = clampPanelPosition(panelX.value, panelY.value, panelW.value, panelH.value);
		panelX.value = nextPos.x;
		panelY.value = nextPos.y;

		if (persist) savePanelPrefs();
	}

	function onViewportResize() {
		if (dragging.active || resizing.active) return;
		applyViewportConstraints({ persist: true });
	}

	function bindViewportListeners() {
		if (_hasViewportListeners) return;
		try {
			window.addEventListener('resize', onViewportResize, { passive: true });
			window.addEventListener('orientationchange', onViewportResize, { passive: true });
			_hasViewportListeners = true;
		} catch {
			// ignore
		}
	}

	function unbindViewportListeners() {
		if (!_hasViewportListeners) return;
		try {
			window.removeEventListener('resize', onViewportResize);
			window.removeEventListener('orientationchange', onViewportResize);
		} catch {
			// ignore
		}
		_hasViewportListeners = false;
	}

	// Cleanup ResizeObserver and pending timers when the scope is disposed.
	onScopeDispose(() => {
		cleanupPanel();
		if (_savePanelPrefsTimer != null) {
			clearTimeout(_savePanelPrefsTimer);
			_savePanelPrefsTimer = null;
		}
	});

	function readPanelPrefs() {
		const parsed = readStorageJson(prefsKey, {
			storage: localStorage,
			fallback: null,
		});
		return parsed && typeof parsed === 'object' ? parsed : null;
	}

	function _writePanelPrefs() {
		const payload = {
			x: panelX.value,
			y: panelY.value,
			w: panelW.value,
			h: panelH.value,
			fontSize: detailFontSize.value,
		};
		writeStorageJson(prefsKey, payload, {
			storage: localStorage,
			warnOnError: false,
		});
	}

	/** Debounced panel prefs write — avoids thrashing localStorage on every ResizeObserver frame. */
	function savePanelPrefs() {
		if (_savePanelPrefsTimer != null) clearTimeout(_savePanelPrefsTimer);
		_savePanelPrefsTimer = setTimeout(() => {
			_savePanelPrefsTimer = null;
			_writePanelPrefs();
		}, 200);
	}

	const dragging = reactive({
		active: false,
		pointerId: null,
		startX: 0,
		startY: 0,
		baseX: 0,
		baseY: 0,
	});

	const resizing = reactive({
		active: false,
		pointerId: null,
		edge: null,
		startX: 0,
		startY: 0,
		baseX: 0,
		baseY: 0,
		baseW: 0,
		baseH: 0,
	});

	function onPanelPointerDown(e) {
		if (!e?.isPrimary) return;
		try {
			const noDrag = e.target?.closest?.('[data-no-drag="true"]');
			if (noDrag) return;
		} catch {
			// ignore
		}
		e.preventDefault?.();
		e.stopPropagation?.();
		dragging.active = true;
		dragging.pointerId = e.pointerId;
		dragging.startX = e.clientX;
		dragging.startY = e.clientY;
		dragging.baseX = panelX.value;
		dragging.baseY = panelY.value;
		try {
			e.currentTarget?.setPointerCapture?.(e.pointerId);
		} catch {
			// ignore
		}
	}

	function onPanelPointerMove(e) {
		if (!dragging.active) return;
		if (dragging.pointerId != null && e.pointerId !== dragging.pointerId) return;
		e.preventDefault?.();

		const dx = e.clientX - dragging.startX;
		const dy = e.clientY - dragging.startY;
		const nextPos = clampPanelPosition(dragging.baseX + dx, dragging.baseY + dy, panelW.value, panelH.value);
		panelX.value = nextPos.x;
		panelY.value = nextPos.y;
	}

	function onPanelPointerUp(e) {
		if (dragging.pointerId != null && e.pointerId !== dragging.pointerId) return;
		const wasDragging = dragging.active;
		if (wasDragging) {
			e.preventDefault?.();
		}
		try {
			e.currentTarget?.releasePointerCapture?.(e.pointerId);
		} catch {
			// ignore
		}
		dragging.active = false;
		dragging.pointerId = null;
		if (wasDragging) savePanelPrefs();
	}

	function onPanelLostPointerCapture(e) {
		if (dragging.pointerId != null && e?.pointerId != null && e.pointerId !== dragging.pointerId) return;
		if (resizing.pointerId != null && e?.pointerId != null && e.pointerId !== resizing.pointerId) return;

		const wasActive = dragging.active || resizing.active;
		dragging.active = false;
		dragging.pointerId = null;
		resizing.active = false;
		resizing.pointerId = null;
		resizing.edge = null;
		if (wasActive) savePanelPrefs();
	}

	function onPanelResizePointerDown(edge, e) {
		if (!e?.isPrimary) return;
		if (!edge) return;
		e.preventDefault?.();
		e.stopPropagation?.();

		resizing.active = true;
		resizing.pointerId = e.pointerId;
		resizing.edge = edge;
		resizing.startX = e.clientX;
		resizing.startY = e.clientY;
		resizing.baseX = panelX.value;
		resizing.baseY = panelY.value;
		resizing.baseW = panelW.value;
		resizing.baseH = panelH.value;

		try {
			e.currentTarget?.setPointerCapture?.(e.pointerId);
		} catch {
			// ignore
		}
	}

	function onPanelResizePointerMove(e) {
		if (!resizing.active) return;
		if (resizing.pointerId != null && e.pointerId !== resizing.pointerId) return;
		e.preventDefault?.();

		const dx = e.clientX - resizing.startX;
		const dy = e.clientY - resizing.startY;

		let nextW = resizing.baseW;
		let nextH = resizing.baseH;

		if (resizing.edge === 'right' || resizing.edge === 'corner') {
			nextW = resizing.baseW + dx;
		}
		if (resizing.edge === 'bottom' || resizing.edge === 'corner') {
			nextH = resizing.baseH + dy;
		}

		const clampedSize = clampPanelSize(nextW, nextH);
		panelW.value = clampedSize.width;
		panelH.value = clampedSize.height;

		const clampedPos = clampPanelPosition(resizing.baseX, resizing.baseY, panelW.value, panelH.value);
		panelX.value = clampedPos.x;
		panelY.value = clampedPos.y;
	}

	function onPanelResizePointerUp(e) {
		if (resizing.pointerId != null && e.pointerId !== resizing.pointerId) return;
		const wasResizing = resizing.active;
		if (wasResizing) {
			e.preventDefault?.();
		}
		try {
			e.currentTarget?.releasePointerCapture?.(e.pointerId);
		} catch {
			// ignore
		}
		resizing.active = false;
		resizing.pointerId = null;
		resizing.edge = null;
		if (wasResizing) savePanelPrefs();
	}

	function clampFontSize(next) {
		const value = Number(next);
		if (!Number.isFinite(value)) return detailFontSize.value;
		return Math.min(fontMax, Math.max(fontMin, value));
	}

	function decFont() {
		detailFontSize.value = clampFontSize(detailFontSize.value - 2);
		savePanelPrefs();
	}

	function incFont() {
		detailFontSize.value = clampFontSize(detailFontSize.value + 2);
		savePanelPrefs();
	}

	function initializePanel() {
		const prefs = readPanelPrefs();
		if (prefs) {
			if (Number.isFinite(Number(prefs.x))) panelX.value = Number(prefs.x);
			if (Number.isFinite(Number(prefs.y))) panelY.value = Number(prefs.y);
			if (Number.isFinite(Number(prefs.w))) panelW.value = Number(prefs.w);
			if (Number.isFinite(Number(prefs.h))) panelH.value = Number(prefs.h);
			if (Number.isFinite(Number(prefs.fontSize))) detailFontSize.value = clampFontSize(Number(prefs.fontSize));
		}
		try {
			const hadSavedPos = prefs && (Number.isFinite(Number(prefs.x)) || Number.isFinite(Number(prefs.y)));
			if (!hadSavedPos) {
				const viewport = getViewportSize();
				panelX.value = viewport.width - panelW.value - 24;
				panelY.value = viewport.height - panelH.value - 24;
			}
		} catch {
			// ignore
		}
		applyViewportConstraints();
		bindViewportListeners();
	}

	function cleanupPanel() {
		unbindViewportListeners();
	}

	function handlePanelRefChange(el, prev) {
		if (!el && prev) return;
		if (!el) return;
		if (dragging.active || resizing.active) return;
		applyViewportConstraints();
	}

	return {
		panelX,
		panelY,
		panelW,
		panelH,
		panelRef,
		detailFontSize,
		onPanelPointerDown,
		onPanelPointerMove,
		onPanelPointerUp,
		onPanelLostPointerCapture,
		onPanelResizePointerDown,
		onPanelResizePointerMove,
		onPanelResizePointerUp,
		decFont,
		incFont,
		initializePanel,
		cleanupPanel,
		handlePanelRefChange,
	};
}
