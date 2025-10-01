import type { PageServerLoad } from './$types';
import { getRideshareToursAsItinerary } from '$lib/server/booking/index';


export const load: PageServerLoad = async ({ locals }) => {
	return await getRideshareToursAsItinerary(locals.session?.userId!, undefined);
};
