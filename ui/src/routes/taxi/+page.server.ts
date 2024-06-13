import { db } from '$lib/database';
import { sql } from 'kysely';

export async function load({ url }) {
	const day = new Date(url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10));
	const day_string = day.toISOString().slice(0, 10);
	const company_id = 1;
	const vehicles = await db
		.selectFrom('vehicle')
		.where('company', '=', company_id)
		.selectAll()
		.execute();
	const tours = await db
		.selectFrom('vehicle')
		.where('company', '=', company_id)
		.innerJoin('tour', 'vehicle', 'vehicle.id')
		.where((eb) =>
			eb.or([
				eb(sql<string>`TO_CHAR(tour.arrival, 'YYYY-MM-DD')`, '=', day_string),
				eb(sql<string>`TO_CHAR(tour.departure, 'YYYY-MM-DD')`, '=', day_string)
			])
		)
		.select(['tour.arrival', 'tour.departure', 'tour.vehicle', 'tour.id'])
		.execute();
	const availabilities = await db
		.selectFrom('vehicle')
		.where('company', '=', company_id)
		.innerJoin('availability', 'vehicle', 'vehicle.id')
		.where((eb) =>
			eb.or([
				eb(sql<string>`TO_CHAR(availability.start_time, 'YYYY-MM-DD')`, '=', day_string),
				eb(sql<string>`TO_CHAR(availability.end_time, 'YYYY-MM-DD')`, '=', day_string)
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
