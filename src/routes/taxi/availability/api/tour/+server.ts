import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sql } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { getPossibleInsertions } from '$lib/util/booking/getPossibleInsertions';
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
				'tour.id',
				jsonArrayFrom(
					eb
						.selectFrom('request')
						.whereRef('tour.id', '=', 'request.tour')
						.select((eb) => [
							'request.bikes',
							'request.wheelchairs',
							'request.luggage',
							'request.passengers',
							'request.id',
							jsonArrayFrom(
								eb
									.selectFrom('event')
									.whereRef('event.request', '=', 'request.id')
									.select([
										'event.scheduledTimeStart',
										'event.scheduledTimeEnd',
										'event.communicatedTime',
										'event.isPickup'
									])
							).as('events')
						])
				).as('requests')
			])
			.executeTakeFirst();
		if (!movedTour) {
			return;
		}
		console.assert(
			movedTour.requests.length != 0,
			'Found a tour which contains no requests. tourId: ',
			movedTour.id
		);
		console.assert(
			!movedTour.requests.some((r) => r.events.length == 0),
			'Found a request which contains no events. requestId: ' +
				movedTour.requests.find((r) => r.events.length === 0)?.id
		);
		if (vehicleId === undefined) {
			error(400, {
				message: 'Keine Fahrzeug-id angegeben'
			});
		}
		const newVehicle = await trx
			.selectFrom('vehicle')
			.where('vehicle.id', '=', vehicleId)
			.select(['vehicle.bikes', 'vehicle.luggage', 'vehicle.wheelchairs', 'vehicle.passengers'])
			.executeTakeFirst();
		if (!newVehicle) {
			error(400, {
				message: 'Keine Fahrzeug-id angegeben'
			});
		}
		const events = movedTour.requests.flatMap((r) =>
			r.events.map((e) => {
				return {
					...e,
					passengers: r.passengers,
					bikes: r.bikes,
					wheelchairs: r.wheelchairs,
					luggage: r.luggage
				};
			})
		);
		const possibleInsertions = getPossibleInsertions(
			newVehicle,
			{ passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 },
			events
		);
		if (
			possibleInsertions.length != 1 ||
			possibleInsertions[0].earliestPickup != 0 ||
			possibleInsertions[0].latestDropoff != events.length
		) {
			return;
		}

		const firstEventTime = Math.min(...events.map((e) => getLatestEventTime(e)));
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
			.where('tour.cancelled', '=', false)
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
