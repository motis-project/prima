import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { db } from '$lib/server/db';
import type { Itinerary, Mode } from '$lib/openapi';

export async function getRideshareToursAsItinerary(
	userId: number,
	tourId: number | undefined
): Promise<{
	journeys: {
		journey: Itinerary;
		id: number;
		cancelled: boolean;
		negotiating: boolean;
		requests: {
			journey: Itinerary;
			name: string;
			email: string;
			phone: string | undefined;
			pending: boolean;
			id: number;
		}[];
		licensePlate: string | undefined;
	}[];
}> {
	let query = db
		.selectFrom('rideShareTour')
		.innerJoin('rideShareVehicle', 'rideShareVehicle.id', 'rideShareTour.vehicle')
		.select((eb) => [
			'rideShareTour.id',
			'communicatedStart',
			'communicatedEnd',
			'cancelled',
			'rideShareVehicle.licensePlate',
			jsonArrayFrom(
				eb
					.selectFrom('request')
					.innerJoin('user', 'user.id', 'request.customer')
					.whereRef('rideShareTour.id', '=', 'request.rideShareTour')
					.where('request.cancelled', '=', false)
					.select((eb) => [
						'request.id',
						'pending',
						'user.id as customerId',
						'user.firstName',
						'user.name',
						'user.email',
						jsonArrayFrom(
							eb
								.selectFrom('event')
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
		query = query.where('rideShareTour.id', '=', tourId);
	}
	const journeys = await query.execute();
	return {
		journeys: journeys.map((journey) => {
			type Evt = (typeof journeys)[0]['requests'][0]['events'][0];
			const j: Itinerary = {
				transfers: 0,
				duration: (journey.communicatedEnd - journey.communicatedStart) / 1000,
				startTime: new Date(journey.communicatedStart).toISOString(),
				endTime: new Date(journey.communicatedEnd).toISOString(),
				legs: []
			};
			const createLeg = (a: Evt, b: Evt) => {
				const start = new Date(a.communicatedTime || 0).toISOString();
				const end = new Date(b.communicatedTime || 0).toISOString();
				return {
					startTime: start,
					scheduledStartTime: start,
					endTime: end,
					scheduledEndTime: end,
					mode: 'RIDE_SHARING' as Mode,
					from: { name: a.address || '', lat: a.lat || 0, lon: a.lng || 0, level: 0 }, // TODO nullable?
					to: { name: b.address || '', lat: b.lat || 0, lon: b.lng || 0, level: 0 },
					duration: ((b.communicatedTime || 0) - (a.communicatedTime || 0)) / 1000,
					scheduled: false,
					realTime: false,
					legGeometry: { points: '', length: 0, precision: 7 }
				};
			};
			const requests =
				tourId == undefined
					? []
					: journey.requests
							.filter((r) => r.customerId != userId)
							.map((r) => {
								const a = r.events[0];
								const b = r.events[1];
								return {
									journey: {
										transfers: 0,
										duration: ((b.communicatedTime || 0) - (a.communicatedTime || 0)) / 1000,
										startTime: new Date(a.communicatedTime || 0).toISOString(),
										endTime: new Date(b.communicatedTime || 0).toISOString(),
										legs: [createLeg(a, b)]
									},
									name: r.firstName + ' ' + r.name,
									email: r.email,
									phone: undefined,
									pending: r.pending,
									id: r.id
								};
							});
			const events = journey.requests
				.flatMap((r) => r.events)
				.sort((a, b) => a.communicatedTime - b.communicatedTime);
			for (let i = 1; i < events.length; i++) {
				j.legs.push(createLeg(events[i - 1], events[i]));
			}
			return {
				journey: j,
				id: journey.id,
				cancelled: journey.cancelled,
				negotiating:
					journey.requests.some((r) => r.pending) && journey.communicatedStart > Date.now(),
				licensePlate: journey.licensePlate,
				requests: requests
			};
		})
	};
}
