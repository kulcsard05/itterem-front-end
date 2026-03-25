import { ref } from 'vue';
import {
	getCategoriesConditional,
	getDrinksConditional,
	getMealsConditional,
	getMenusConditional,
	getSidesConditional,
} from '../services/api.js';
import { cacheImagesForDatasets } from './useMenuImageCache.js';

const DEFAULT_LOADING_STATE = Object.freeze({
	categories: false,
	meals: false,
	sides: false,
	menus: false,
	drinks: false,
});

const DEFAULT_ERROR_STATE = Object.freeze({
	categories: '',
	meals: '',
	sides: '',
	menus: '',
	drinks: '',
});

const DEFAULT_STATUS_STATE = Object.freeze({
	categories: '-',
	meals: '-',
	sides: '-',
	menus: '-',
	drinks: '-',
});

export function useMenuCatalogRefresh({
	t,
	activeType,
	categories,
	meals,
	sides,
	menus,
	drinks,
	setDatasetIfChanged,
	saveMenuCache,
	rehydrateItems,
}) {
	const loading = ref({ ...DEFAULT_LOADING_STATE });
	const errors = ref({ ...DEFAULT_ERROR_STATE });
	const endpointRefreshStatus = ref({ ...DEFAULT_STATUS_STATE });
	const refreshing = ref(false);

	async function loadOne(key, fetcher, targetRef, fallbackMessage) {
		loading.value[key] = true;
		errors.value[key] = '';
		endpointRefreshStatus.value[key] = '...';
		try {
			const result = await fetcher();
			if (result && typeof result === 'object' && 'notModified' in result && result.notModified) {
				endpointRefreshStatus.value[key] = '304';
				return false;
			}

			const data = result && typeof result === 'object' && 'notModified' in result
				? result.data
				: result;

			endpointRefreshStatus.value[key] = '200';
			return setDatasetIfChanged(key, targetRef, data);
		} catch (err) {
			endpointRefreshStatus.value[key] = 'ERR';
			errors.value[key] = err instanceof Error ? err.message : fallbackMessage;
			return false;
		} finally {
			loading.value[key] = false;
		}
	}

	async function refreshAll() {
		refreshing.value = true;
		try {
			const endpointLoaders = [
				['categories', getCategoriesConditional, categories, t('menu.loadErrors.categories')],
				['meals', getMealsConditional, meals, t('menu.loadErrors.meals')],
				['sides', getSidesConditional, sides, t('menu.loadErrors.sides')],
				['menus', getMenusConditional, menus, t('menu.loadErrors.menus')],
				['drinks', getDrinksConditional, drinks, t('menu.loadErrors.drinks')],
			];

			const changes = await Promise.allSettled(
				endpointLoaders.map(([key, fetcher, targetRef, fallback]) =>
					loadOne(key, fetcher, targetRef, fallback),
				),
			);

			const hasChanges = changes.some((entry) => entry.status === 'fulfilled' && entry.value === true);
			if (hasChanges) {
				await saveMenuCache();
			}

			// Re-hydrate cart items with the latest menu data (names, prices, images).
			rehydrateItems();

			// Download and cache any new images in the background.
			// Skips kep values that are already cached — cheap to call every time.
			void cacheImagesForDatasets(categories.value, meals.value, sides.value, menus.value, drinks.value).catch(() => {
				// Image prefetch failures are non-critical for menu rendering.
			});
		} catch {
			errors.value[activeType.value] = t(`menu.loadErrors.${activeType.value}`);
		} finally {
			refreshing.value = false;
		}
	}

	return {
		loading,
		errors,
		endpointRefreshStatus,
		refreshing,
		refreshAll,
	};
}
