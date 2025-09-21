import { Interval } from '$lib/util/interval';
import { sql, type Transaction } from 'kysely';
import type { Capacities } from '$lib/util/booking/Capacities';
import { db, type Database } from '$lib/server/db';
import { jsonArrayFrom } from 'kysely/helpers/postgres';

function selectByRequestId(requestId: number, trx: Transaction<Database>) {
	return trx
		.selectFrom('rideShareTour')
		.innerJoin('request', 'request.rideShareTour', 'rideShareTour.id')
		.where('request.id', '=', requestId)
		.where('rideShareTour.cancelled', '=', false);
}

function selectWithoutRequestId(
	requestCapacities: Capacities,
	searchInterval: Interval,
	trx?: Transaction<Database>,
	tourId?: number
) {
	return (trx ?? db)
		.selectFrom('rideShareTour')
		.where('rideShareTour.passengers', '>=', requestCapacities.passengers)
		.$if(tourId !== undefined, (qb) => qb.where('rideShareTour.id', '=', tourId!))
		.where((eb) =>
			eb(
				'rideShareTour.luggage',
				'>=',
				sql<number>`cast(${requestCapacities.passengers} as integer) + cast(${requestCapacities.luggage} as integer) - ${eb.ref('rideShareTour.passengers')}`
			)
		)
		.where('rideShareTour.cancelled', '=', false)
		.where((eb) =>
			eb(
				eb
					.selectFrom('request')
					.innerJoin('event', 'event.request', 'request.id')
					.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
					.select('eventGroup.scheduledTimeEnd')
					.whereRef('request.rideShareTour', '=', 'rideShareTour.id')
					.where('request.pending', '=', false)
					.orderBy('eventGroup.scheduledTimeEnd asc')
					.limit(1),
				'<=',
				searchInterval.endTime
			)
		)
		.where((eb) =>
			eb(
				eb
					.selectFrom('request')
					.innerJoin('event', 'event.request', 'request.id')
					.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
					.select('eventGroup.scheduledTimeStart')
					.whereRef('request.rideShareTour', '=', 'rideShareTour.id')
					.where('request.pending', '=', false)
					.orderBy('eventGroup.scheduledTimeStart desc')
					.limit(1),
				'>=',
				searchInterval.startTime
			)
		);
}

async function select(query: RideShareQuery) {
	return (await query.select((eb) => [
				'rideShareTour.id as rideShareTour',
				'rideShareTour.luggage',
				'rideShareTour.passengers',
				'rideShareTour.provider',
				jsonArrayFrom(
					eb
						.selectFrom('request')
						.innerJoin('event', 'event.request', 'request.id')
						.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
						.where('request.pending', '=', false)
						.orderBy('eventGroup.scheduledTimeEnd asc')
						.orderBy('eventGroup.scheduledTimeStart asc')
						.select([
							'event.id as eventId',
							'request.id as requestId',
							'eventGroup.id as eventGroupId',
							'eventGroup.lat',
							'eventGroup.lng',
							'eventGroup.scheduledTimeStart',
							'eventGroup.scheduledTimeEnd',
							'event.isPickup',
							'eventGroup.prevLegDuration',
							'eventGroup.nextLegDuration',
							'rideShareTour.id as tourId',
							'request.passengers',
							'request.luggage',
							'request.wheelchairs',
							'request.bikes',
							'request.customer'
						])
				).as('events')
			])
			.execute()
	).map((t) => {
		const events = t.events.sort((e1, e2) => e1.scheduledTimeStart - e2.scheduledTimeStart);
		const departure = events[0].scheduledTimeEnd;
		const arrival = events[events.length - 1].scheduledTimeStart;
		return {
			...t,
			wheelchairs: 0,
			bikes: 0,
			events: events.map((e) => {
				return {
					...e,
					time: new Interval(e.scheduledTimeStart, e.scheduledTimeEnd),
					departure,
					arrival
				};
			}),
			departure,
			arrival
		};
	});
}

export async function getRideShareTourByRequest(requestId: number, trx: Transaction<Database>) {
	console.log(
		'getRideShareTours by request params: ', requestId
	);
	const dbResult = await select(selectByRequestId(requestId, trx));	

	console.log('getRideShareTours: dbResult=', JSON.stringify(dbResult, null, '\t'));
	return dbResult;
}

export const getRideShareTours = async (
	requestCapacities: Capacities,
	searchInterval: Interval,
	trx?: Transaction<Database>,
	tourId?: number
) => {
	console.log(
		'getRideShareTours params: ',
		JSON.stringify(
			{
				searchInterval: searchInterval.toString(),
				requestCapacities
			},
			null,
			'\t'
		)
	);
	const dbResult = await select(selectWithoutRequestId(requestCapacities, searchInterval, trx, tourId));	

	console.log('getRideShareTours: dbResult=', JSON.stringify(dbResult, null, '\t'));
	return dbResult;
};

export type RideShareTour = Awaited<ReturnType<typeof getRideShareTours>>[0];
export type RideShareEvent = RideShareTour['events'][0];
type RideShareQuery = Awaited<ReturnType<typeof selectWithoutRequestId>>;
