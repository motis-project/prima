import type { PageServerLoad } from './$types.js';
import { queryCompletedTours } from '$lib/sqlHelpers.js';
import { queryAvailabilities } from '$lib/sqlHelpers.js';
import { mapTourEvents } from '$lib/TourDetails.js';

export const load: PageServerLoad = async () => {
	return {
		tours: mapTourEvents(await queryCompletedTours(undefined)),
		availabilities: await queryAvailabilities()
	};
};
