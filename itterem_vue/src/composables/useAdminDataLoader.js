import {
	getCategories,
	getDrinks,
	getIngredients,
	getMeals,
	getMenus,
	getOrders,
	getSides,
} from '../api.js';
import { readAdminDatasetCache, writeAdminDatasetCache } from '../storage/admin-cache.js';
import { asArray } from '../utils.js';
import { ref } from 'vue';

const ENTITY_LOAD_LABELS = Object.freeze({
	order: ['orders'],
	menu: ['menus', 'meals', 'sides', 'drinks'],
	category: ['categories', 'meals'],
	ingredient: ['ingredients', 'meals'],
	meal: ['meals', 'menus'],
	side: ['sides', 'menus'],
	drink: ['drinks', 'menus'],
});

export function useAdminDataLoader({
	isLoading,
	loadError,
	clearFeedback,
	reconcileSelection,
	rendelesekRaw,
	menukRaw,
	kategoriak,
	hozzavalok,
	keszetelek,
	koretek,
	uditok,
}) {
	const showingStorageSnapshot = ref(false);
	const storageSnapshotLoadedAt = ref(null);

	const dataLoads = [
		{ fn: getOrders, ref: rendelesekRaw, label: 'orders' },
		{ fn: getMenus, ref: menukRaw, label: 'menus' },
		{ fn: getCategories, ref: kategoriak, label: 'categories' },
		{ fn: getIngredients, ref: hozzavalok, label: 'ingredients' },
		{ fn: getMeals, ref: keszetelek, label: 'meals' },
		{ fn: getSides, ref: koretek, label: 'sides' },
		{ fn: getDrinks, ref: uditok, label: 'drinks' },
	];

	function getLoadLabelsForEntity(entityType) {
		const labels = ENTITY_LOAD_LABELS[String(entityType ?? '').trim()];
		return asArray(labels);
	}

	function hydrateFromStorage(loadsToRun) {
		const hydratedLabels = new Set();
		let latestHydratedAt = null;

		loadsToRun.forEach((load) => {
			const cached = readAdminDatasetCache(load.label);
			if (!cached) return;
			load.ref.value = asArray(cached.items);
			hydratedLabels.add(load.label);
			if (cached.updatedAt && (latestHydratedAt == null || cached.updatedAt > latestHydratedAt)) {
				latestHydratedAt = cached.updatedAt;
			}
		});

		if (hydratedLabels.size > 0) {
			showingStorageSnapshot.value = true;
			storageSnapshotLoadedAt.value = latestHydratedAt ?? Date.now();
			reconcileSelection();
		}

		return hydratedLabels;
	}

	async function loadAdminData(labels = null) {
		if (isLoading.value) return;
		isLoading.value = true;
		loadError.value = '';
		clearFeedback();

		const requestedLabels = asArray(labels)
			.map((label) => String(label ?? '').trim())
			.filter(Boolean);
		const loadsToRun = requestedLabels.length > 0
			? dataLoads.filter((load) => requestedLabels.includes(load.label))
			: dataLoads;

		if (loadsToRun.length === 0) {
			reconcileSelection();
			isLoading.value = false;
			return;
		}

		const hydratedLabels = hydrateFromStorage(loadsToRun);

		const results = await Promise.allSettled(loadsToRun.map((load) => load.fn()));
		let hasFreshServerData = false;
		let hasStorageBackedFailures = false;

		results.forEach((result, index) => {
			const load = loadsToRun[index];
			if (result.status === 'fulfilled') {
				const nextValue = asArray(result.value);
				load.ref.value = nextValue;
				writeAdminDatasetCache(load.label, nextValue);
				hasFreshServerData = true;
			} else {
				if (!hydratedLabels.has(load.label)) {
					load.ref.value = [];
				} else {
					hasStorageBackedFailures = true;
				}
				loadError.value =
					loadError.value ||
					(result.reason instanceof Error
						? result.reason.message
						: `Failed to load ${load.label}`);
			}
		});

		if (hasStorageBackedFailures) {
			showingStorageSnapshot.value = true;
		} else if (hasFreshServerData || hydratedLabels.size === 0) {
			showingStorageSnapshot.value = false;
		}

		reconcileSelection();
		isLoading.value = false;
	}

	async function loadAdminDataForEntity(entityType) {
		const labels = getLoadLabelsForEntity(entityType);
		if (labels.length === 0) {
			await loadAdminData();
			return;
		}
		await loadAdminData(labels);
	}

	return {
		loadAdminData,
		loadAdminDataForEntity,
		showingStorageSnapshot,
		storageSnapshotLoadedAt,
	};
}
