import { onUnmounted, ref } from 'vue';

export function useTransientSetAnimation(timeoutMs = 350) {
	const activeKeys = ref(new Set());
	const timersByKey = new Map();

	function clearKeyTimer(key) {
		const existingTimer = timersByKey.get(key);
		if (existingTimer == null) return;
		window.clearTimeout(existingTimer);
		timersByKey.delete(key);
	}

	function trigger(key) {
		if (!key) return;

		clearKeyTimer(key);
		activeKeys.value.delete(key);

		requestAnimationFrame(() => {
			activeKeys.value.add(key);
			const timerId = window.setTimeout(() => {
				activeKeys.value.delete(key);
				timersByKey.delete(key);
			}, timeoutMs);
			timersByKey.set(key, timerId);
		});
	}

	function isActive(key) {
		return activeKeys.value.has(key);
	}

	function clearAll() {
		for (const timerId of timersByKey.values()) {
			window.clearTimeout(timerId);
		}
		timersByKey.clear();
		activeKeys.value.clear();
	}

	onUnmounted(() => {
		clearAll();
	});

	return {
		activeKeys,
		isActive,
		trigger,
		clearAll,
	};
}
