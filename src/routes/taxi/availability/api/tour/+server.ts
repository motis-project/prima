import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sql } from 'kysely';

export const POST = async (event) => {
	const companyId = event.locals.session?.companyId;
	if (!companyId) {
		throw 'no company id';
	}
	const request = event.request;
	const { tourId, vehicleId } = await request.json();
	await db.transaction().execute(async (trx) => {
		await sql`LOCK TABLE tour IN ACCESS EXCLUSIVE MODE;`.execute(trx);
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
		const collidingTours = await trx
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
		if (collidingTours.length == 0) {
			await trx
				.updateTable('tour')
				.set({ vehicle: vehicleId })
				.where('id', '=', tourId)
				.executeTakeFirst();
		}
	});
	return json({});
};
