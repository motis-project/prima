import { db } from '$lib/database';

export async function load() {
	let company_id = 2;
	const vehicles = await db.selectFrom('vehicle').where('company', '=', company_id).selectAll().execute();
	const tours = await db
		.selectFrom('vehicle')
		.where('company', '=', company_id)
		.innerJoin('tour', 'vehicle', 'vehicle.id')
		.select(['tour.arrival', 'tour.departure', 'tour.vehicle', 'tour.id'])
		.execute();
	return {
		vehicles,
		tours
	};
}
