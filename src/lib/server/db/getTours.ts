import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { db } from '.';

export const getTours = async (companyId?: number, timeRange?: [Date, Date]) => {
	return await db
		.selectFrom('tour')
		.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
		.innerJoin('company', 'company.id', 'vehicle.company')
		.$if(typeof companyId === 'number', (qb) => qb.where('company', '=', companyId!))
		.$if(!!timeRange, (qb) =>
			qb.where((eb) =>
				eb.and([eb('tour.departure', '<', timeRange![1]), eb('tour.arrival', '>', timeRange![0])])
			)
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
					.whereRef('event.tour', '=', 'tour.id')
					.innerJoin('user', 'user.id', 'event.customer')
					.selectAll(['event', 'tour', 'vehicle'])
					.select(['user.name as customerName', 'user.phone as customerPhone'])
					.orderBy('event.scheduledTime')
			).as('events')
		])
		.execute();
};

export type Tours = Awaited<ReturnType<typeof getTours>>;
export type Tour = Tours[0];
export type TourEvent = Tour['events'][0];
