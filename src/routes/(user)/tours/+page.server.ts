import type { PageServerLoad } from './$types.js';
import { mapTourEvents } from '$lib/TourDetails.js';
import { queryCompletedTours } from '$lib/sqlHelpers.js';

export const load: PageServerLoad = async (event) => {
	return {
		tours: mapTourEvents(await queryCompletedTours(event.locals.user?.company))
	};
};
