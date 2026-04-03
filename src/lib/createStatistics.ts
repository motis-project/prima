import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { db } from '$lib/server/db';
import type { Coordinates } from '$lib/util/Coordinates';
import { carRouting } from '$lib/util/carRouting';
import type { Itinerary, Leg } from '$lib/openapi';

export async function createStatistics() {
	await computeAndPersistStatistics('tour');
	await computeAndPersistStatistics('rideShareTour');
}

async function tourQuery() {
	return await db
		.selectFrom('tour')
		.innerJoin('request', 'request.tour', 'tour.id')
		.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
		.innerJoin('company', 'company.id', 'vehicle.company')
		.where('tour.arrival', '<', Date.now())
		.where('tour.approachAndReturnM', 'is', null)
		.where('tour.cancelled', '=', false)
		.select((eb) => [
			jsonArrayFrom(
				eb
					.selectFrom('request')
					.innerJoin('event', 'event.request', 'request.id')
					.innerJoin('eventGroup', 'event.eventGroupId', 'eventGroup.id')
					.where('request.cancelled', '=', false)
					.whereRef('request.tour', '=', 'tour.id')
					.selectAll(['event', 'eventGroup'])
					.select('request.passengers')
			).as('events'),
			'company.lat',
			'company.lng',
			'tour.id'
		])
		.execute();
}

async function rideShareTourQuery() {
	return (
		await db
			.selectFrom('rideShareTour as tour')
			.where('tour.approachAndReturnM', 'is', null)
			.where('tour.cancelled', '=', false)
			.where('tour.latestEnd', '<', Date.now())
			.select((eb) => [
				jsonArrayFrom(
					eb
						.selectFrom('request')
						.innerJoin('event', 'event.request', 'request.id')
						.innerJoin('eventGroup', 'event.eventGroupId', 'eventGroup.id')
						.where('request.cancelled', '=', false)
						.whereRef('request.tour', '=', 'tour.id')
						.selectAll(['event', 'eventGroup'])
						.select('request.passengers')
				).as('events')
			])
			.execute()
	).map((t) => ({ ...t, lat: 0, lng: 0, id: 0 }));
}

type Tours = Awaited<ReturnType<typeof tourQuery>>;
type Tour = Tours[0];
type Event = Tour['events'][0];

async function computeStatistics(events: Event[], company?: Coordinates) {
	const routingQueries = new Array<Promise<Itinerary | undefined>>(events.length);
	for (let i = 0; i < events.length - 1; ++i) {
		routingQueries[i] = carRouting(events[i], events[i + 1]);
	}
	const routingResults = await Promise.all(routingQueries);
	const distances = routingResults.map((r) => legsToTravelDistance(r?.legs));

	let currentPassengers = 0;
	let occupiedM = 0;
	let fullyPayedM = 0;
	for (let i = 0; i != events.length; ++i) {
		const curr = events[i];
		currentPassengers += curr.isPickup ? curr.passengers : -curr.passengers;
		if (currentPassengers !== 0) {
			occupiedM += distances[i];
		}
		fullyPayedM += distances[i];
	}

	let approachPlusReturn = 0;
	if (company !== undefined) {
		const routingResultApproach = await carRouting(company, events[0]);
		const routingResultReturn = await carRouting(events[events.length - 1], company);
		approachPlusReturn =
			legsToTravelDistance(routingResultApproach?.legs) +
			legsToTravelDistance(routingResultReturn?.legs);
	}
	return {
		approachPlusReturn,
		fullyPayedM,
		occupiedM
	};
}

function legToTravelDistance(leg: Leg): number {
	return leg.distance!;
}

function legsToTravelDistance(legs: Leg[] | undefined) {
	return legs === undefined
		? 0
		: legs.reduce((prev, curr) => (prev += legToTravelDistance(curr)), 0);
}

async function computeAndPersistStatistics(type: 'tour' | 'rideShareTour') {
	const tours = type === 'tour' ? await tourQuery() : await rideShareTourQuery();
	const stats = await Promise.all(
		tours.map(
			async (t) =>
				await computeStatistics(
					t.events.sort((e1, e2) => e1.scheduledTimeStart - e2.scheduledTimeStart),
					type === 'tour' ? { lat: t.lat!, lng: t.lng! } : undefined
				)
		)
	);
	for (let i = 0; i != tours.length; ++i) {
		await db
			.updateTable(type)
			.set({
				fullyPayedM: Math.round(stats[i].fullyPayedM),
				approachAndReturnM: Math.round(stats[i].approachPlusReturn),
				occupiedM: Math.round(stats[i].occupiedM)
			})
			.where('id', '=', tours[i].id)
			.execute();
	}
}
