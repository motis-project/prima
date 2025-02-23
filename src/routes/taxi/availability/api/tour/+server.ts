import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sql } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { getLatestEventTime } from '$lib/util/getLatestEventTime';

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
			.select((eb) => [
				'tour.departure',
				'tour.arrival',
				jsonArrayFrom(
					eb
						.selectFrom('request')
						.whereRef('tour.id', '=', 'request.tour')
						.select((eb) => [
							jsonArrayFrom(
								eb
									.selectFrom('event')
									.whereRef('event.request', '=', 'request.id')
									.select([
										'event.scheduledTimeStart',
										'event.scheduledTimeEnd',
										'event.communicatedTime'
									])
							).as('events')
						])
				).as('requests')
			])
			.executeTakeFirst();
		if (!movedTour) {
			return;
		}
		console.assert(movedTour.requests.length != 0, 'Found a tour which contains no requests.');
		console.assert(
			!movedTour.requests.some((r) => r.events.length == 0),
			'Found a request which contains no events.'
		);
		const events = movedTour.requests.flatMap((r) => r.events);
		const firstEventTime = getLatestEventTime(
			events.reduce(
				(min, entry) => (getLatestEventTime(entry) < getLatestEventTime(min) ? entry : min),
				events[0]
			)
		);
		if (firstEventTime < Date.now()) {
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
