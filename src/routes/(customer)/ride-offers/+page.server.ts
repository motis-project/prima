import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
	const journeys = await db
		.selectFrom('rideShareTour')
		.leftJoin('request', 'rideShareTour.id', 'request.rideShareTour')
		.groupBy('rideShareTour.id').groupBy('rideShareTour.communicatedStartTime').groupBy('rideShareTour.communicatedEndTime').groupBy('cancelled')
		.orderBy('rideShareTour.communicatedStartTime')
		.select(({ fn }) => ['id', 'communicatedStartTime', 'communicatedEndTime', 'cancelled', fn.max<number>('request.pending').as('pending'),])
		.where('provider', '=', locals.session!.userId!)
		.execute();
	return {
		journeys: journeys.map((journey) => {
			return {
				journey: journey.json, // TODO
				id: journey.id,
				cancelled: journey.cancelled,
				negotiating: journey.pending
			};
		})
	};
};
