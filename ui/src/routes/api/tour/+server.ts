import { json } from '@sveltejs/kit';
import { db } from '$lib/database';
import { sql } from 'kysely';

export const POST = async ({ request }) => {
	const { tour_id, vehicle_id } = await request.json();
	await db.transaction().execute(async (trx) => {
		sql`LOCK TABLE tour IN ACCESS EXCLUSIVE MODE;`.execute(trx);
		const moved_tour = await trx.selectFrom('tour').where('id','=',tour_id).selectAll().execute();
		if(moved_tour.length > 0){
		const colliding_tours = await trx
			.selectFrom('tour')
			.where('vehicle', '=', vehicle_id)
			.where(({and,eb}) =>
				eb.and([
					eb('tour.departure', '<', moved_tour[0].arrival),
					eb('tour.arrival', '>', moved_tour[0].departure)
				])
			)
			.selectAll()
			.execute();
			if (colliding_tours.length == 0) {
				await trx
					.updateTable('tour')
					.set({ vehicle: vehicle_id })
					.where('id', '=', tour_id)
					.executeTakeFirst();
			}
		}
	});
	return json({});
};
