import { buildEntityConfigs } from './admin-entity-configs/buildEntityConfigs.js';
import { getMenuDrinkId, getMenuMealId, getMenuSideId } from './admin-entity-configs/shared.js';

/**
 * Build entity configs for the admin dashboard.
 * @param {{ kategoriak, hozzavalok, keszetelek, koretek, uditok }} refs - reactive refs to entity lists
 */
export function useAdminEntityConfigs({ kategoriak, hozzavalok, keszetelek, koretek, uditok }) {
	const entityConfigs = buildEntityConfigs({
		kategoriak,
		hozzavalok,
		keszetelek,
		koretek,
		uditok,
	});

	return {
		entityConfigs,
		getMenuMealId,
		getMenuSideId,
		getMenuDrinkId,
	};
}
