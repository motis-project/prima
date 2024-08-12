import type { PageServerLoad } from './$types.js';
<<<<<<< HEAD
import { mapTourEvents } from '../taxi/TourDetails.js';
import { queryCompletedTours } from '$lib/sqlHelpers.js';
=======
import { db } from '$lib/database';
import { TZ } from '$lib/constants.js';
import { mapTourEvents } from '$lib/TourDetails.js';
>>>>>>> tour-re-dispo-ui

export const load: PageServerLoad = async (event) => {
	return {
		tours: mapTourEvents(await queryCompletedTours(event.locals.user?.company))
	};
};
