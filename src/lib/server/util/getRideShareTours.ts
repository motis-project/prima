import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { db } from '../db';
import { sql } from 'kysely';

export async function getRideShareTours(selectCancelled: boolean, selectPending?: boolean) {
	return await db
		.selectFrom('rideShareTour')
		.innerJoin('rideShareVehicle', 'rideShareVehicle.id', 'rideShareTour.vehicle')
		.innerJoin('user as provider', 'provider.id', 'rideShareVehicle.owner')
		.$if(!selectCancelled, (qb) => qb.where('rideShareTour.cancelled', '=', false))
		.select((eb) => [
			'rideShareTour.earliestStart as startTime',
			'rideShareTour.latestEnd as endTime',
			'rideShareTour.id as tourId',
			'rideShareVehicle.id as vehicleId',
			'rideShareVehicle.licensePlate',
			'rideShareTour.cancelled',
			jsonArrayFrom(
				eb
					.selectFrom('request')
					.where('request.rideShareTour', 'is not', null)
					.whereRef('rideShareTour.id', '=', 'request.rideShareTour')
					.$if(!selectCancelled, (qb) => qb.where('request.cancelled', '=', false))
					.$if(selectPending !== undefined, (qb) =>
						qb.where('request.pending', '=', selectPending!)
					)
					.select((eb) => [
						'request.luggage',
						'request.passengers',
						'request.wheelchairs',
						'request.bikes',
						'request.kidsZeroToTwo',
						'request.kidsThreeToFour',
						'request.kidsFiveToSix',
						'request.ticketChecked',
						'request.ticketPrice',
						'request.id as requestId',
						'request.cancelled',
						eb('request.startFixed', 'is', null).as('isInitial'),
						jsonArrayFrom(
							eb
								.selectFrom('event')
								.whereRef('event.request', '=', 'request.id')
								.innerJoin('user', 'user.id', 'request.customer')
								.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
								.$if(!selectCancelled, (qb) => qb.where('event.cancelled', '=', false))
								.select((eb) => [
									'rideShareTour.id as tour',
									'user.name as customerName',
									'user.phone as customerPhone',
									'event.id',
									'event.communicatedTime',
									'eventGroup.address',
									'event.isPickup',
									'eventGroup.lat',
									'eventGroup.lng',
									'eventGroup.nextLegDuration',
									'eventGroup.prevLegDuration',
									'eventGroup.scheduledTimeStart',
									'eventGroup.scheduledTimeEnd',
									'event.eventGroupId',
									'event.cancelled',
									'request.cancelled as requestCancelled',
									'request.bikes',
									'request.customer',
									'request.luggage',
									'request.passengers',
									'request.ticketChecked',
									'request.ticketPrice',
									'request.wheelchairs',
									'request.id as requestId',
									'request.pending',
									eb('request.startFixed', 'is', null).as('isInitial')
								])
								.select(sql<string>`md5(request.ticket_code)`.as('ticketHash'))
								.orderBy('eventGroup.scheduledTimeStart')
						).as('events')
					])
			).as('requests')
		])
		.execute();
}

export type RideShareToursWithRequests = Awaited<ReturnType<typeof getRideShareTours>>;
export type RideShareTourWithRequests = RideShareToursWithRequests[0];
export type RideShareTourRequest = RideShareTourWithRequests['requests'][0];
export type RideShareTourWithRequestsEvents = RideShareTourRequest['events'];
export type RideShareTourWithRequestsEvent = RideShareTourWithRequestsEvents[0];
