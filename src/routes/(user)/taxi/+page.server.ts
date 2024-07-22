import { TZ } from '$lib/constants.js';
import { db } from '$lib/database';
import { mapTourEvents } from './TourDetails';

export async function load(event) {
	const companyId = event.locals.user?.company;
	const url = event.url;
	const localDateParam = url.searchParams.get('date');
	const localDate = localDateParam ? new Date(localDateParam) : new Date();
	const utcDate = new Date(localDate.toLocaleString('en', { timeZone: TZ }));
	utcDate.setHours(0, 0, 0, 0);
	if (!companyId) {
		return {
			tours: [],
			vehicles: [],
			availabilities: [],
			utcDate
		};
	}
	const earliest_displayed_time = new Date(utcDate);
	earliest_displayed_time.setHours(utcDate.getHours() - 1);
	const latest_displayed_time = new Date(utcDate);
	latest_displayed_time.setHours(utcDate.getHours() + 25);

	const vehicles = db.selectFrom('vehicle').where('company', '=', companyId).selectAll().execute();

	const availabilities = db
		.selectFrom('vehicle')
		.where('company', '=', companyId)
		.innerJoin('availability', 'vehicle', 'vehicle.id')
		.where((eb) =>
			eb.and([
				eb('availability.start_time', '<', latest_displayed_time),
				eb('availability.end_time', '>', earliest_displayed_time)
			])
		)
		.select([
			'availability.id',
			'availability.start_time',
			'availability.end_time',
			'availability.vehicle'
		])
		.execute();

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
			.where('company', '=', companyId)
			.orderBy('event.scheduled_time')
			.selectAll()
			.execute()
	);

	return {
		tours,
		vehicles: await vehicles,
		availabilities: await availabilities,
		utcDate
	};
}
