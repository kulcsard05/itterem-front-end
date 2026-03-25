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

	let panelResizeObserver = null;
	let _savePanelPrefsTimer = null;

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

	function onPanelPointerDown(e) {
		if (!e?.isPrimary) return;
		try {
			const noDrag = e.target?.closest?.('[data-no-drag="true"]');
			if (noDrag) return;
		} catch {
			// ignore
		}
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

		const dx = e.clientX - dragging.startX;
		const dy = e.clientY - dragging.startY;
		panelX.value = Math.max(0, dragging.baseX + dx);
		panelY.value = Math.max(0, dragging.baseY + dy);
	}

	function onPanelPointerUp(e) {
		if (dragging.pointerId != null && e.pointerId !== dragging.pointerId) return;
		dragging.active = false;
		dragging.pointerId = null;
		savePanelPrefs();
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
			if (Number.isFinite(Number(prefs.x))) panelX.value = Math.max(0, Number(prefs.x));
			if (Number.isFinite(Number(prefs.y))) panelY.value = Math.max(0, Number(prefs.y));
			if (Number.isFinite(Number(prefs.w))) panelW.value = Math.max(minWidth, Number(prefs.w));
			if (Number.isFinite(Number(prefs.h))) panelH.value = Math.max(minHeight, Number(prefs.h));
			if (Number.isFinite(Number(prefs.fontSize))) detailFontSize.value = clampFontSize(Number(prefs.fontSize));
		}
		try {
			const hadSavedPos = prefs && (Number.isFinite(Number(prefs.x)) || Number.isFinite(Number(prefs.y)));
			if (!hadSavedPos) {
				panelX.value = Math.max(0, window.innerWidth - panelW.value - 24);
				panelY.value = Math.max(0, window.innerHeight - panelH.value - 24);
			}
		} catch {
			// ignore
		}
	}

	function cleanupPanel() {
		if (panelResizeObserver) {
			try {
				panelResizeObserver.disconnect();
			} catch {
				// ignore
			}
			panelResizeObserver = null;
		}
	}

	function handlePanelRefChange(el, prev) {
		if (prev && panelResizeObserver) {
			try {
				panelResizeObserver.disconnect();
			} catch {
				// ignore
			}
			panelResizeObserver = null;
		}
		if (!el) return;
		if (typeof ResizeObserver === 'undefined') return;

		panelResizeObserver = new ResizeObserver((entries) => {
			if (dragging.active) return;

			const entry = entries && entries[0];
			const target = entry?.target;
			let nextW = null;
			let nextH = null;

			try {
				const box = target?.getBoundingClientRect?.();
				if (box) {
					nextW = box.width;
					nextH = box.height;
				}
			} catch {
				// ignore
			}

			if (!Number.isFinite(nextW) || !Number.isFinite(nextH)) {
				const rect = entry?.contentRect;
				if (!rect) return;
				nextW = rect.width;
				nextH = rect.height;
			}

			const w = Math.max(minWidth, Math.round(nextW));
			const h = Math.max(minHeight, Math.round(nextH));
			if (Math.abs(w - panelW.value) >= 1) panelW.value = w;
			if (Math.abs(h - panelH.value) >= 1) panelH.value = h;
			savePanelPrefs();
		});
		try {
			panelResizeObserver.observe(el);
		} catch {
			// ignore
		}
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
		decFont,
		incFont,
		initializePanel,
		cleanupPanel,
		handlePanelRefChange,
	};
}
