import type { PageServerLoad } from './$types';
import { getRideshareToursAsItinerary } from '$lib/server/booking/index';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
	return {
		...(await getRideshareToursAsItinerary(locals.session!.userId!, undefined)),
		notifications: await db
			.selectFrom('desiredRideShare')
			.where('desiredRideShare.interestedUser', '=', locals.session?.userId ?? -1)
			.selectAll()
			.execute()
	};
};
