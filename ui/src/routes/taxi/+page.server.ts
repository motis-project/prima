import { db } from '$lib/database';
import { sql } from 'kysely';

export async function load({ url }) {
	const company_id = 1;
	const day = new Date(url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10));
	let earliest_displayed_time = new Date(day);
	earliest_displayed_time.setHours(day.getHours() - 1);
	let latest_displayed_time = new Date(day);
	latest_displayed_time.setHours(day.getHours() + 25);
	const day_string = day.toISOString().slice(0, 10);
	const vehicles = await db
		.selectFrom('vehicle')
		.where('company', '=', company_id)
		.selectAll()
		.execute();
	const tours = await db
		.selectFrom('vehicle')
		.where('company', '=', company_id)
		.innerJoin('tour', 'vehicle', 'vehicle.id')
		.where(({or, and, eb}) =>
			or([
				and([
					eb('tour.departure', '>=', earliest_displayed_time),
					eb('tour.departure', '<', latest_displayed_time)
				]),
				and([
					eb('tour.arrival', '>', earliest_displayed_time),
					eb('tour.arrival', '<=', latest_displayed_time)
				])
			])
		)
		.select(['tour.arrival', 'tour.departure', 'tour.vehicle', 'tour.id'])
		.execute();
	const availabilities = await db
		.selectFrom('vehicle')
		.where('company', '=', company_id)
		.innerJoin('availability', 'vehicle', 'vehicle.id')
		.where(({or, and, eb}) =>
			or([
				and([
					eb('availability.start_time', '>=', earliest_displayed_time),
					eb('availability.start_time', '<', latest_displayed_time)
				]),
				and([
					eb('availability.end_time', '>', earliest_displayed_time),
					eb('availability.end_time', '<=', latest_displayed_time)
				])
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
		vehicles,
		tours,
		day,
		availabilities
	};
}
