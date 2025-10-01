import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { db, type Database } from '$lib/server/db';
import type { Itinerary, Mode } from '$lib/openapi';

export async function getRideshareToursAsItinerary(
	userId: number,
	tourId: number | undefined,
): Promise<{ journeys: { journey: Itinerary; id: number; cancelled: boolean; negotiating: boolean; }[]; }> {
	const query = db
		.selectFrom('rideShareTour')
		.innerJoin('rideShareVehicle', 'rideShareVehicle.id', 'rideShareTour.vehicle')
		.select((eb) => [
			'rideShareTour.id', 'communicatedStart', 'communicatedEnd', 'cancelled', 'rideShareVehicle.licensePlate',
			jsonArrayFrom(
				eb
					.selectFrom('request')
					.innerJoin('user', 'user.id', 'request.customer')
					.whereRef('rideShareTour.id', '=', 'request.rideShareTour')
					.where('request.cancelled', '=', false)
					.select((eb) => [
						'pending',
						'user.firstName',
						'user.name',
						'user.email',
						jsonArrayFrom(
							eb.selectFrom('event')
								.whereRef('event.request', '=', 'request.id')
								.leftJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
								.orderBy('event.communicatedTime')
								.select([
									'event.isPickup',
									'event.communicatedTime',
									'eventGroup.lat',
									'eventGroup.lng',
									'eventGroup.address'
								])
						).as('events')
					])
			).as('requests')
		])
		.where('owner', '=', userId);
	if (tourId != undefined) {
		query.where('id', '=', tourId);
	}
	const journeys = await query
		.execute();

	return {
		journeys: journeys.map((journey) => {
			const j: Itinerary = {
				transfers: 0,
				duration: (journey.communicatedEnd - journey.communicatedStart) / 1000,
				startTime: new Date(journey.communicatedStart).toISOString(),
				endTime: new Date(journey.communicatedEnd).toISOString(),
				legs: []
			};
			const createLeg = (a, b) => {
				const start = new Date(a.communicatedTime || 0).toISOString();
				const end = new Date(b.communicatedTime || 0).toISOString();
				return {
					startTime: start,
					scheduledStartTime: start,
					endTime: end,
					scheduledEndTime: end,
					mode: 'ODM' as Mode, // TODO
					from: { name: a.address || '', lat: a.lat || 0, lon: a.lng || 0, level: 0 }, // TODO nullable?
					to: { name: b.address || '', lat: b.lat || 0, lon: b.lng || 0, level: 0 },
					duration: ((b.communicatedTime || 0) - (a.communicatedTime || 0)) / 1000,
					realTime: false,
					legGeometry: { points: '', length: 0 }
				};
			}
			const requests = tourId == undefined ? [] : journey.requests.map(r => {
				const a = r.events[0];
				const b = r.events[1];
				return {
					journey: {
						transfers: 0,
						duration: ((b.communicatedTime || 0) - (a.communicatedTime || 0)) / 1000,
						startTime: new Date(a.communicatedTime || 0).toISOString(),
						endTime: new Date(b.communicatedTime || 0).toISOString(),
						legs: [createLeg(a, b)]
					}
				};
			});
			const events = journey.requests.flatMap(r => r.events).sort((a, b) => a.communicatedTime - b.communicatedTime);
			for (let i = 1; i < events.length; i++) {
				j.legs.push(createLeg(events[i - 1], events[i]));
			}
			return {
				journey: j,
				id: journey.id,
				cancelled: journey.cancelled,
				negotiating: journey.requests.some(r => r.pending),
				requests: tourId == undefined ? [] : requests
			};
		})
	};
}
