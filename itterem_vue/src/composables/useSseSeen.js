import { reactive } from 'vue';

export function useSseSeen({ limit, trimTo, markDuration }) {
	const seen = reactive(new Map());

	function markSeen(id) {
		const key = String(id ?? '').trim();
		if (!key) return;
		seen.set(key, Date.now());
		if (seen.size > limit) {
			const sorted = Array.from(seen.entries()).sort((a, b) => a[1] - b[1]);
			for (let i = 0; i < sorted.length - trimTo; i += 1) seen.delete(sorted[i][0]);
		}
	}

	function isSeenMarked(id) {
		const key = String(id ?? '').trim();
		if (!key) return false;
		const ts = seen.get(key);
		if (!ts) return false;
		return Date.now() - ts < markDuration;
	}

	return {
		seen,
		markSeen,
		isSeenMarked,
	};
}
