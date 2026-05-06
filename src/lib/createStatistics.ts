import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { db } from '$lib/server/db';
import type { Coordinates } from '$lib/util/Coordinates';
import { carRouting } from '$lib/util/carRouting';
import { type Mode, type Itinerary, type Leg } from '$lib/openapi';
import { polyLineToLatLngArray } from '$lib/util/polylineToGeoJSON';

export async function createStatistics() {
	await computeAndPersistTourStatistics('tour', false);
	await computeAndPersistTourStatistics('rideShareTour', false);
	await computeAndPersistRequestStatistics(false);
	await computeAndPersistTourStatistics('tour', true);
	await computeAndPersistTourStatistics('rideShareTour', true);
	await computeAndPersistRequestStatistics(true);
}

async function requestQuery(cancelled: boolean) {
	return await db
		.selectFrom('tour')
		.innerJoin('request', 'request.tour', 'tour.id')
		.innerJoin('journey', (join) =>
			join.on((eb) =>
				eb.or([
					eb('journey.request1', '=', eb.ref('request.id')),
					eb('journey.request2', '=', eb.ref('request.id'))
				])
			)
		)
		.where('tour.arrival', '<', Date.now())
		.where('request.odmDistance', 'is', null)
		.where('tour.cancelled', '=', cancelled)
		.select((eb) => [
			'journey.json',
			'request.id',
			eb('request.tour', 'is', null).as('isRideShareRequest')
		])
		.execute();
}

async function tourQuery(cancelled: boolean) {
	return (
		await db
			.selectFrom('tour')
			.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
			.innerJoin('company', 'company.id', 'vehicle.company')
			.where('tour.arrival', '<', Date.now())
			.where('tour.approachAndReturnM', 'is', null)
			.where('tour.cancelled', '=', cancelled)
			.select((eb) => [
				jsonArrayFrom(
					eb
						.selectFrom('request')
						.innerJoin('event', 'event.request', 'request.id')
						.innerJoin('eventGroup', 'event.eventGroupId', 'eventGroup.id')
						.where('request.cancelled', '=', cancelled)
						.$if(cancelled, (qb) => qb.where('request.cancelledByCustomer', '=', true))
						.whereRef('request.tour', '=', 'tour.id')
						.selectAll(['event', 'eventGroup'])
						.select('request.passengers')
				).as('events'),
				'company.lat',
				'company.lng',
				'tour.id'
			])
			.execute()
	).map((t) => {
		const companyCoords = { lat: t.lat!, lng: t.lng! };
		return { ...t, start: companyCoords, target: companyCoords };
	});
}

async function rideShareTourQuery(cancelled: boolean) {
	return (
		await db
			.selectFrom('rideShareTour')
			.innerJoin('rideShareVehicle', 'rideShareTour.vehicle', 'rideShareVehicle.id')
			.where('rideShareTour.approachAndReturnM', 'is', null)
			.where('rideShareTour.cancelled', '=', cancelled)
			.where('rideShareTour.latestEnd', '<', Date.now())
			.select((eb) => [
				jsonArrayFrom(
					eb
						.selectFrom('request')
						.innerJoin('event', 'event.request', 'request.id')
						.innerJoin('eventGroup', 'event.eventGroupId', 'eventGroup.id')
						.where('request.cancelled', '=', cancelled)
						.$if(cancelled, (qb) => qb.where('request.cancelledByCustomer', '=', true))
						.whereRef('request.rideShareTour', '=', 'rideShareTour.id')
						.selectAll(['event', 'eventGroup'])
						.select(['request.passengers', 'request.customer'])
				).as('events'),
				'rideShareTour.id',
				'rideShareVehicle.owner'
			])
			.execute()
	).map((t) => {
		const start = t.events.find((e) => e.isPickup && e.customer === t.owner)!;
		const target = t.events.find((e) => !e.isPickup && e.customer === t.owner)!;
		return { ...t, events: t.events.filter((e) => e.customer !== t.owner), start, target };
	});
}

type Tours = Awaited<ReturnType<typeof tourQuery>>;
type Tour = Tours[0];
type Event = Tour['events'][0];

type Request = Awaited<ReturnType<typeof requestQuery>>[0];

async function computeStatistics(events: Event[], start: Coordinates, target: Coordinates) {
	const routingQueries = new Array<Promise<Itinerary | undefined>>(events.length);
	for (let i = 0; i < events.length - 1; ++i) {
		routingQueries[i] = carRouting(events[i], events[i + 1]);
	}
	const routingResults = await Promise.all(routingQueries);
	const distances = routingResults.map((r) => legsToTravelDistance(r?.legs));

	let currentPassengers = 0;
	let occupiedM = 0;
	let fullyPayedM = 0;
	let cumulatedPassengerM = 0;
	for (let i = 0; i != events.length; ++i) {
		const curr = events[i];
		currentPassengers += curr.isPickup ? curr.passengers : -curr.passengers;
		if (currentPassengers !== 0) {
			occupiedM += distances[i];
			cumulatedPassengerM += distances[i] * currentPassengers;
		}
		fullyPayedM += distances[i];
	}

	let approachPlusReturn = 0;
	const routingResultApproach = await carRouting(start, events[0]);
	const routingResultReturn = await carRouting(events[events.length - 1], target);
	approachPlusReturn =
		legsToTravelDistance(routingResultApproach?.legs) +
		legsToTravelDistance(routingResultReturn?.legs);
	return {
		approachPlusReturn,
		fullyPayedM,
		occupiedM,
		cumulatedPassengerM,
		totalM: approachPlusReturn + fullyPayedM
	};
}

export function haversineDistance(c1: Coordinates, c2: Coordinates) {
	function toRad(deg: number) {
		return (deg * Math.PI) / 180;
	}
	const R = 6371000; // Earth radius in meters

	const dLat = toRad(c2.lat - c1.lat);
	const dLon = toRad(c2.lng - c1.lng);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(c1.lat)) * Math.cos(toRad(c2.lat)) * Math.sin(dLon / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

function legToTravelDistance(leg: Leg): number {
	const legGeometry = polyLineToLatLngArray(leg.legGeometry.points).map((v) => ({
		lat: v[0],
		lng: v[1]
	}));
	let sum = 0;
	for (let i = 1; i != legGeometry.length; ++i) {
		const prev = legGeometry[i - 1];
		const curr = legGeometry[i];
		sum += haversineDistance(prev, curr);
	}
	return sum;
}

function legsToTravelDistance(legs: Leg[] | undefined) {
	return legs === undefined
		? 0
		: legs.reduce((prev, curr) => (prev += legToTravelDistance(curr)), 0);
}

async function computeAndPersistTourStatistics(type: 'tour' | 'rideShareTour', cancelled: boolean) {
	const tours = type === 'tour' ? await tourQuery(cancelled) : await rideShareTourQuery(cancelled);
	const stats = await Promise.all(
		tours.map(
			async (t) =>
				await computeStatistics(
					t.events.sort((e1, e2) => e1.scheduledTimeStart - e2.scheduledTimeStart),
					t.start,
					t.target
				)
		)
	);
	for (let i = 0; i != tours.length; ++i) {
		await db
			.updateTable(type)
			.set({
				fullyPayedM: Math.round(stats[i].fullyPayedM),
				approachAndReturnM: Math.round(stats[i].approachPlusReturn),
				occupiedM: Math.round(stats[i].occupiedM),
				cumulatedPassengerM: Math.round(stats[i].cumulatedPassengerM),
				totalM: Math.round(stats[i].totalM)
			})
			.where('id', '=', tours[i].id)
			.execute();
	}
}

async function computeAndPersistRequestStatistics(cancelled: boolean) {
	const requests = await requestQuery(cancelled);
	const stats = requests.map((r) => computeRequestStatistics(r));
	for (let i = 0; i != requests.length; ++i) {
		let odmDistance = 0;
		let publicTransportDistance = 0;
		for (const [mode, stat] of stats[i]) {
			switch (mode) {
				case 'WALK':
					break;
				case 'ODM':
					odmDistance += stat;
					break;
				case 'RIDE_SHARING':
					odmDistance += stat;
					break;
				default:
					publicTransportDistance += stat;
					break;
			}
		}
		await db
			.updateTable('request')
			.set({
				odmDistance: Math.round(odmDistance),
				publicTransportDistance: Math.round(publicTransportDistance)
			})
			.where('id', '=', requests[i].id)
			.execute();
	}
}

function computeRequestStatistics(request: Request) {
	const sums = new Map<Mode, number>();
	for (const leg of request.json.legs) {
		sums.set(leg.mode, (sums.get(leg.mode) ?? 0) + legToTravelDistance(leg));
	}
	return sums;
}
