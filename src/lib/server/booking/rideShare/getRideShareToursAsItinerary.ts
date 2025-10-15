import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { db } from '$lib/server/db';
import type { Itinerary, Leg, Mode } from '$lib/openapi';

export async function getRideshareToursAsItinerary(
	providerId: number,
	tourId: number | undefined
): Promise<{
	journeys: {
		journey: Itinerary;
		id: number;
		cancelled: boolean;
		negotiating: boolean;
		requests: {
			journey: Itinerary;
			firstName: string;
			name: string;
			gender: string;
			profilePicture: string | null;
			email: string;
			phone: string | undefined;
			pending: boolean;
			id: number;
			averageRatingCustomer: string | number | null;
			requestCancelled: boolean;
		}[];
		licensePlate: string | undefined;
	}[];
}> {
	let query = db
		.selectFrom('rideShareTour')
		.innerJoin('rideShareVehicle', 'rideShareVehicle.id', 'rideShareTour.vehicle')
		.orderBy('rideShareTour.communicatedStart asc')
		.select((eb) => [
			'rideShareTour.id',
			'communicatedStart',
			'communicatedEnd',
			'rideShareTour.cancelled as tourCancelled',
			'rideShareVehicle.licensePlate',
			jsonArrayFrom(
				eb
					.selectFrom('request')
					.innerJoin('user', 'user.id', 'request.customer')
					.whereRef('rideShareTour.id', '=', 'request.rideShareTour')
					.select((eb) => [
						'request.id',
						'pending',
						'user.id as customerId',
						'user.firstName',
						'user.name',
						'user.gender',
						'user.email',
						'user.profilePicture',
						'request.cancelled as requestCancelled',
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
						).as('events'),
						eb
							.selectFrom('rideShareRating')
							.innerJoin('request as ratedRequest', 'rideShareRating.request', 'ratedRequest.id')
							.whereRef('ratedRequest.customer', '=', 'user.id')
							.where('rideShareRating.ratedIsCustomer', '=', true)
							.where('ratedRequest.pending', '=', false)
							.where('ratedRequest.startFixed', 'is not', null)
							.select(db.fn.avg('rideShareRating.rating').as('averageRating'))
							.as('averageRatingCustomer')
					])
			).as('requests')
		])
		.where('owner', '=', providerId);
	if (tourId != undefined) {
		query = query.where('rideShareTour.id', '=', tourId);
	}
	const journeys = await query.execute();
	return {
		journeys: journeys.map((journey) => {
			type Evt = (typeof journeys)[0]['requests'][0]['events'][0];
			const j: Itinerary = {
				transfers: 0,
				duration: (journey.communicatedEnd - journey.communicatedStart) / 1000 || 1,
				startTime: new Date(journey.communicatedStart).toISOString(),
				endTime: new Date(journey.communicatedEnd).toISOString(),
				legs: []
			};
			const createLeg = (a: Evt, b: Evt): Leg => {
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
					duration: ((b.communicatedTime || 0) - (a.communicatedTime || 0)) / 1000 || 1,
					scheduled: false,
					realTime: false,
					legGeometry: { points: '', length: 0, precision: 7 }
				};
			};
			const requests =
				tourId == undefined
					? []
					: journey.requests
							.filter((r) => r.customerId != providerId)
							.map((r) => {
								const a = r.events[0];
								const b = r.events[1];
								return {
									journey: {
										transfers: 0,
										duration: ((b.communicatedTime || 0) - (a.communicatedTime || 0)) / 1000 || 1,
										startTime: new Date(a.communicatedTime || 0).toISOString(),
										endTime: new Date(b.communicatedTime || 0).toISOString(),
										legs: [createLeg(a, b)]
									},
									firstName: r.firstName,
									name: r.name,
									gender: r.gender,
									profilePicture: r.profilePicture,
									email: r.email,
									phone: undefined,
									pending: r.pending,
									id: r.id,
									averageRatingCustomer: r.averageRatingCustomer,
									requestCancelled: r.requestCancelled
								};
							});
			const events = journey.requests
				.flatMap((r) => r.events)
				.sort((a, b) => a.communicatedTime - b.communicatedTime);
			const leg = createLeg(events[0], events[events.length - 1]);
			leg.intermediateStops = [];
			for (let i = 1; i < events.length - 1; i++) {
				const a = events[i];
				const time = new Date(a.communicatedTime || 0).toISOString();
				leg.intermediateStops.push({
					name: a.address || '',
					lat: a.lat || 0,
					lon: a.lng || 0,
					level: 0,
					arrival: time,
					departure: time,
					scheduledArrival: time,
					scheduledDeparture: time
				});
			}
			j.legs.push(leg);
			return {
				journey: j,
				id: journey.id,
				cancelled: journey.tourCancelled,
				negotiating:
					journey.requests.some((r) => r.pending && !r.requestCancelled) &&
					journey.communicatedStart > Date.now(),
				licensePlate: journey.licensePlate,
				requests
			};
		})
	};
}
