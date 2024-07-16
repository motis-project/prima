import { TZ } from '$lib/constants.js';
import { db } from '$lib/database';

export async function load({ url }) {
	const company_id = 1;
	const localDateParam = url.searchParams.get('date');
	const localDate = localDateParam ? new Date(localDateParam) : new Date();
	const utcDate = new Date(localDate.toLocaleString('en', { timeZone: TZ }));
	utcDate.setHours(0, 0, 0, 0);
	const earliest_displayed_time = new Date(utcDate);
	earliest_displayed_time.setHours(utcDate.getHours() - 1);
	const latest_displayed_time = new Date(utcDate);
	latest_displayed_time.setHours(utcDate.getHours() + 25);
	const vehicles = db.selectFrom('vehicle').where('company', '=', company_id).selectAll().execute();

	const tours = await db
		.selectFrom('vehicle')
		.where('company', '=', company_id)
		.innerJoin('tour', 'vehicle', 'vehicle.id')
		.where((eb) =>
			eb.and([
				eb('tour.departure', '<', latest_displayed_time),
				eb('tour.arrival', '>', earliest_displayed_time)
			])
		)
		.select(['tour.arrival', 'tour.departure', 'tour.vehicle', 'tour.id'])
		.execute();

	const availabilities = db
		.selectFrom('vehicle')
		.where('company', '=', company_id)
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

	const events =
		tours.length === 0
			? []
			: db
					.selectFrom('tour')
					.where(
						'tour.id',
						'in',
						tours.map((t) => t.id)
					)
					.innerJoin('event', 'event.tour', 'tour.id')
					.innerJoin('address', 'address.id', 'event.address')
					.selectAll()
					.execute();

	return {
		vehicles: await vehicles,
		tours: tours,
		availabilities: await availabilities,
		events: await events,
		utcDate
	};
}
