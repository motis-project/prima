import type { PageServerLoad } from './$types.js';
import { queryCompletedTours } from '$lib/sqlHelpers.js';
import { mapTourEvents } from '../../(user)/taxi/TourDetails.js';

export const load: PageServerLoad = async () => {
	return {
		tours: mapTourEvents(await queryCompletedTours(undefined))
	};
};
