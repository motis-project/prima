import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
	const journeys = await db
		.selectFrom('journey')
		.leftJoin('request', 'journey.request1', 'request.id')
		.leftJoin('tour', 'tour.id', 'request.tour')
		.orderBy('tour.departure asc')
		.select(['json', 'journey.id as journeyId', 'request.ticketCode', 'request.cancelled'])
		.where('user', '=', locals.session!.userId!)
		.execute();
	return {
		journeys: journeys.map((journey) => {
			return {
				journey: journey.json,
				id: journey.journeyId,
				ticketCode: journey.ticketCode,
				cancelled: journey.cancelled
			};
		})
	};
};
