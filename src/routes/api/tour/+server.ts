import { error, json } from '@sveltejs/kit';
import { db } from '$lib/database';
import { sql } from 'kysely';
import { mapTourEvents } from '$lib/TourDetails.js';

export const POST = async (event) => {
	const companyId = event.locals.user?.company;
	if (!companyId) {
		error(400, {
			message: 'not allowed without write access to company'
		});
	}
	const request = event.request;
	const { tour_id: tourId, vehicle_id: vehicleId } = await request.json();
	await db.transaction().execute(async (trx) => {
		sql`LOCK TABLE tour IN ACCESS EXCLUSIVE MODE;`.execute(trx);
		const movedTour = await trx
			.selectFrom('tour')
			.where(({ eb }) =>
				eb.and([
					eb('tour.id', '=', tourId),
					eb.exists((eb) =>
						eb
							.selectFrom('vehicle')
							.selectAll()
							.where(({ eb }) =>
								eb.and([
									eb('vehicle.id', '=', eb.ref('tour.vehicle')),
									eb('vehicle.company', '=', companyId)
								])
							)
					)
				])
			)
			.selectAll()
			.executeTakeFirst();
		if (!movedTour) {
			return;
		}
		const colliding_tours = await trx
			.selectFrom('tour')
			.where('tour.vehicle', '=', vehicleId)
			.where(({ eb }) =>
				eb.and([
					eb('tour.departure', '<', movedTour.arrival),
					eb('tour.arrival', '>', movedTour.departure)
				])
			)
			.selectAll()
			.execute();
		if (colliding_tours.length == 0) {
			await trx
				.updateTable('tour')
				.set({ vehicle: vehicleId })
				.where('id', '=', tourId)
				.executeTakeFirst();
		}
	});
	return json({});
};

export const GET = async (event) => {
	const company = event.locals.user?.company;
	if (!company) {
		error(400, {
			message: 'not allowed without write access to company'
		});
	}
	const url = event.url;
	const dateParam = url.searchParams.get('date');

	const earliest_displayed_time = new Date(dateParam + ' 00:00:00');
	const latest_displayed_time = new Date(dateParam + ' 23:59:59');
	const tours = mapTourEvents(
		await db
			.selectFrom('event')
			.innerJoin('address', 'address.id', 'event.address')
			.innerJoin('auth_user', 'auth_user.id', 'event.customer')
			.innerJoin('tour', 'tour.id', 'event.tour')
			.where((eb) =>
				eb.and([
					eb('tour.departure', '<', latest_displayed_time),
					eb('tour.arrival', '>', earliest_displayed_time)
				])
			)
			.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
			.innerJoin('company', 'company.id', 'vehicle.company')
			.where('company', '=', company)
			.orderBy('event.scheduled_time')
			.selectAll(['event', 'address', 'tour', 'vehicle'])
			.select([
				'company.name as company_name',
				'company.address as company_address',
				'auth_user.first_name as customer_first_name',
				'auth_user.last_name as customer_last_ame',
				'auth_user.phone as customer_phone'
			])
			.execute()
	);

	return json(tours);
}
