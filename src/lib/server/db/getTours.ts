import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { db } from '.';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';
import { sql } from 'kysely';

export const getTours = async (
	selectCancelled: boolean,
	companyId?: number,
	timeRange?: [UnixtimeMs, UnixtimeMs]
) => {
	return await db
		.selectFrom('tour')
		.$if(!selectCancelled, (qb) => qb.where('tour.cancelled', '=', false))
		.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
		.innerJoin('company', 'company.id', 'vehicle.company')
		.$if(typeof companyId === 'number', (qb) => qb.where('company', '=', companyId!))
		.$if(!!timeRange, (qb) =>
			qb.where('tour.departure', '<', timeRange![1]).where('tour.arrival', '>', timeRange![0])
		)
		.select((eb) => [
			'tour.id as tourId',
			'tour.fare as fare',
			'tour.departure as startTime',
			'tour.arrival as endTime',
			'tour.cancelled',
			'tour.message',
			'company.name as companyName',
			'company.address as companyAddress',
			'company.lat as companyLat',
			'company.lng as companyLng',
			'vehicle.id as vehicleId',
			'vehicle.licensePlate as licensePlate',
			jsonArrayFrom(
				eb
					.selectFrom('event')
					.$if(!selectCancelled, (qb) => qb.where('event.cancelled', '=', false))
					.innerJoin('request', 'request.id', 'event.request')
					.whereRef('tour.id', '=', 'request.tour')
					.innerJoin('user', 'user.id', 'request.customer')
					.select((eb) => [
						eb.case()
							.when('event.isPickup', '=', true)
							.then(eb.ref('scheduledTimeStart'))
							.else(eb.ref('scheduledTimeEnd'))
							.end()
							.as('scheduledTime'),
						'tour.id as tour',
						'user.name as customerName',
						'user.phone as customerPhone',
						'event.id',
						'event.address',
						'event.eventGroup',
						'event.isPickup',
						'event.lat',
						'event.lng',
						'event.cancelled',
						'request.bikes',
						'request.customer',
						'request.luggage',
						'request.passengers',
						'request.wheelchairs',
						'request.id as requestId',
						'request.ticketChecked',
						'request.ticketPrice',
						'request.kidsZeroToTwo',
						'request.kidsThreeToFour',
						'request.kidsFiveToSix',
					])
					.select(sql<string>`md5(request.ticket_code)`.as('ticketHash'))
					.orderBy('event.scheduledTimeStart')
			).as('events')
		])
		.execute();
};

export const getToursWithRequests = async (
	selectCancelled: boolean,
	companyId?: number,
	timeRange?: [UnixtimeMs, UnixtimeMs]
) => {
	return await db
		.selectFrom('tour')
		.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
		.innerJoin('company', 'company.id', 'vehicle.company')
		.$if(!selectCancelled, (qb) => qb.where('tour.cancelled', '=', false))
		.$if(companyId != undefined, (qb) => qb.where('company.id', '=', companyId!))
		.$if(!!timeRange, (qb) =>
			qb.where('tour.departure', '<', timeRange![1]).where('tour.arrival', '>', timeRange![0])
		)
		.select((eb) => [
			'tour.fare as fare',
			'tour.departure as startTime',
			'tour.arrival as endTime',
			'tour.cancelled',
			'tour.id as tourId',
			'tour.message',
			'company.name as companyName',
			'company.id as companyId',
			'company.lat as companyLat',
			'company.lng as companyLng',
			'vehicle.id as vehicleId',
			'vehicle.licensePlate',
			'tour.directDuration',
			jsonArrayFrom(
				eb
					.selectFrom('request')
					.whereRef('tour.id', '=', 'request.tour')
					.$if(!selectCancelled, (qb) => qb.where('request.cancelled', '=', false))
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
						jsonArrayFrom(
							eb
								.selectFrom('event')
								.whereRef('event.request', '=', 'request.id')
								.innerJoin('user', 'user.id', 'request.customer')
								.$if(!selectCancelled, (qb) => qb.where('event.cancelled', '=', false))
								.select([
									'tour.id as tour',
									'user.name as customerName',
									'user.phone as customerPhone',
									'event.id',
									'event.communicatedTime',
									'event.address',
									'event.eventGroup',
									'event.isPickup',
									'event.lat',
									'event.lng',
									'event.nextLegDuration',
									'event.prevLegDuration',
									'event.scheduledTimeStart',
									'event.scheduledTimeEnd',
									'event.cancelled',
									'request.cancelled as requestCancelled',
									'tour.cancelled as tourCancelled',
									'request.bikes',
									'request.customer',
									'request.luggage',
									'request.passengers',
									'request.ticketChecked',
									'request.ticketPrice',
									'request.wheelchairs',
									'request.id as requestId'
								])
								.select(sql<string>`md5(request.ticket_code)`.as('ticketHash'))
								.orderBy('event.scheduledTimeStart')
						).as('events')
					])
			).as('requests')
		])
		.execute();
};
