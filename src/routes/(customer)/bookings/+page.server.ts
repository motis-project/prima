import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import type { Itinerary } from '$lib/openapi';
import { jsonArrayFrom } from 'kysely/helpers/postgres';

export const load: PageServerLoad = async ({ locals }) => {
	const journeys = await db
		.selectFrom('journey')
		.innerJoin('request', 'journey.request1', 'request.id')
		.innerJoin('tour', 'tour.id', 'request.tour')
		.orderBy('tour.departure asc')
		.select((eb) => [
			jsonArrayFrom(
				eb
					.selectFrom('event')
					.whereRef('event.request', '=', 'request.id')
					.orderBy('isPickup', 'desc')
					.select(['event.address'])
			).as('addresses'),
			'json',
			'journey.id as journeyId',
			'request.ticketCode',
			'request.cancelled',
			'tour.arrival'
		])
		.where('user', '=', locals.session!.userId!)
		.execute();
	return {
		journeys: journeys.map((journey) => {
			return {
				journey: {
					...(JSON.parse(journey.json) as Itinerary),
					startAddress: journey.addresses[0].address,
					targetAddress: journey.addresses[1].address
				},
				id: journey.journeyId,
				ticketCode: journey.ticketCode,
				cancelled: journey.cancelled,
				arrival: journey.arrival
			};
		})
	};
};
