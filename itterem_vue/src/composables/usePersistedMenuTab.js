import { ref, watch } from 'vue';

const MENU_ACTIVE_TAB_STORAGE_KEY = 'menu-active-tab-v1';
const MENU_TAB_KEYS = Object.freeze(['meals', 'sides', 'menus', 'drinks']);

function readStoredActiveType() {
	try {
		const stored = String(localStorage.getItem(MENU_ACTIVE_TAB_STORAGE_KEY) ?? '').trim();
		return MENU_TAB_KEYS.includes(stored) ? stored : 'meals';
	} catch {
		return 'meals';
	}
}

export function usePersistedMenuTab() {
	const activeType = ref(readStoredActiveType());

	watch(activeType, (next) => {
		try {
			localStorage.setItem(MENU_ACTIVE_TAB_STORAGE_KEY, next);
		} catch {
			// ignore storage failures
		}
	});

	return {
		activeType,
	};
}
