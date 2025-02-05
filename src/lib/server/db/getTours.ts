import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { db } from '.';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';

export const getTours = async (companyId?: number, timeRange?: [UnixtimeMs, UnixtimeMs]) => {
	return await db
		.selectFrom('tour')
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
			'company.name as companyName',
			'company.address as companyAddress',
			'vehicle.id as vehicleId',
			'vehicle.licensePlate as licensePlate',
			jsonArrayFrom(
				eb
					.selectFrom('event')
					.innerJoin('request', 'request.id', 'event.request')
					.whereRef('tour.id', '=', 'request.tour')
					.innerJoin('user', 'user.id', 'request.customer')
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
						'request.bikes',
						'request.customer',
						'request.luggage',
						'request.passengers',
						'request.wheelchairs'
					])
					.orderBy('event.scheduledTimeStart')
			).as('events')
		])
		.execute();
};

export type Tours = Awaited<ReturnType<typeof getTours>>;
export type Tour = Tours[0];
export type TourEvent = Tour['events'][0];
