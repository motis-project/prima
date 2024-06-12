import { db } from '$lib/database';

export async function load({ url }) {
	const day = new Date(url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10));
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
		.select(['tour.arrival', 'tour.departure', 'tour.vehicle', 'tour.id'])
		.execute();
	return {
		vehicles,
		tours,
		day
	};
}
