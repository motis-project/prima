import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import type { Itinerary } from '$lib/openapi';

export const load: PageServerLoad = async ({ locals }) => {
	const journeys = await db
		.selectFrom('journey')
		.innerJoin('request', 'journey.request1', 'request.id')
		.select(['json', 'journey.id as journeyId', 'request.ticketCode', 'request.cancelled'])
		.where('user', '=', locals.session!.userId!)
		.execute();
	return {
		journeys: journeys.map((journey) => {
			return {
				journey: JSON.parse(journey.json) as Itinerary,
				id: journey.journeyId,
				ticketCode: journey.ticketCode,
				cancelled: journey.cancelled
			};
		})
	};
};
