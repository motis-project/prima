import { groupBy } from '$lib/collection_utils.js';
import { TZ } from '$lib/constants.js';
import { db } from '$lib/database';

export async function load({ url }) {
	const company_id = 1;
	const tourID = url.searchParams.get('tour');
	const localDateParam = url.searchParams.get('date');
	const localDate = localDateParam ? new Date(localDateParam) : new Date();
	const utcDate = new Date(localDate.toLocaleString('en', { timeZone: TZ }));
	utcDate.setHours(0, 0, 0, 0);
	const earliest_displayed_time = new Date(utcDate);
	earliest_displayed_time.setHours(utcDate.getHours() - 1);
	const latest_displayed_time = new Date(utcDate);
	latest_displayed_time.setHours(utcDate.getHours() + 25);
	const vehicles = db.selectFrom('vehicle').where('company', '=', company_id).selectAll().execute();

	const events = await db
		.selectFrom('event')
		.innerJoin('tour', 'tour.id', 'event.tour')
		.where((eb) =>
			eb.and([
				eb('tour.departure', '<', latest_displayed_time),
				eb('tour.arrival', '>', earliest_displayed_time)
			])
		)
		.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
		.where('company', '=', company_id)
		.selectAll()
		.execute();

	const toursMap = groupBy(events, (e) => {
		return {
			tour_id: e.tour,
			from: e.departure,
			to: e.arrival,
			vehicle_id: e.vehicle
		}
	}, (e) => { address: e.address });
	const tours = [...toursMap].map(([tour, events]) => { return { ...tour, events } });

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

	return {
		tours,
		vehicles: await vehicles,
		availabilities: await availabilities,
		utcDate
	};
}
