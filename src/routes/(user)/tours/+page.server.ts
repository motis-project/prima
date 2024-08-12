import type { PageServerLoad } from './$types.js';
import { queryCompletedTours } from '$lib/sqlHelpers.js';
import { mapTourEvents } from '$lib/TourDetails.js';

export const load: PageServerLoad = async (event) => {
	return {
		tours: mapTourEvents(await queryCompletedTours(event.locals.user?.company))
	};
};
