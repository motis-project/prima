import type { Transaction } from 'kysely';
import { type Database } from '$lib/server/db';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { oneToManyCarRouting } from '../util/oneToManyCarRouting';

export async function updateDirectDurations(
	oldVehicleId: number,
	tourId: number,
	departure: number,
	trx: Transaction<Database>,
	newVehicleId?: number
) {
	const vehicleIds = [oldVehicleId];
	if (newVehicleId) {
		vehicleIds.push(newVehicleId);
	}
	const vehicles = await trx
		.selectFrom('vehicle')
		.where('vehicle.id', 'in', vehicleIds)
		.select((eb) => [
			'vehicle.id',
			jsonArrayFrom(
				eb
					.selectFrom('tour')
					.whereRef('tour.vehicle', '=', 'vehicle.id')
					.where('tour.cancelled', '=', false)
					.where('tour.departure', '<=', departure)
					.orderBy('tour.departure', 'asc')
					.limit(1)
					.select((eb) => [
						jsonArrayFrom(
							eb
								.selectFrom('request')
								.innerJoin('event', 'event.request', 'request.id')
								.where('request.cancelled', '=', false)
								.whereRef('request.tour', '=', 'tour.id')
								.orderBy('event.scheduledTimeEnd', 'desc')
								.limit(1)
								.select(['event.lat', 'event.lng', 'request.tour', 'event.scheduledTimeStart'])
						).as('events')
					])
			).as('prevtour'),
			jsonArrayFrom(
				eb
					.selectFrom('tour')
					.whereRef('tour.vehicle', '=', 'vehicle.id')
					.where('tour.cancelled', '=', false)
					.where('tour.departure', '>', departure)
					.orderBy('tour.departure', 'asc')
					.limit(1)
					.select((eb) => [
						jsonArrayFrom(
							eb
								.selectFrom('request')
								.innerJoin('event', 'event.request', 'request.id')
								.where('request.cancelled', '=', false)
								.whereRef('request.tour', '=', 'tour.id')
								.orderBy('event.scheduledTimeEnd', 'asc')
								.limit(1)
								.select(['event.lat', 'event.lng', 'request.tour', 'event.scheduledTimeStart'])
						).as('events')
					])
			).as('nexttour'),
			jsonArrayFrom(
				eb
					.selectFrom('tour')
					.where('tour.id', '=', tourId)
					.select((eb) => [
						jsonArrayFrom(
							eb
								.selectFrom('request')
								.innerJoin('event', 'event.request', 'request.id')
								.where('request.cancelled', '=', false)
								.whereRef('request.tour', '=', 'tour.id')
								.orderBy('event.scheduledTimeEnd', 'asc')
								.select(['event.lat', 'event.lng', 'event.scheduledTimeStart'])
						).as('events')
					])
			).as('moved')
		])
		.execute();

	const oldVehicle = vehicles[0].id === oldVehicleId ? vehicles[0] : vehicles[1];
	if (
		oldVehicle?.nexttour &&
		oldVehicle.nexttour.length != 0 &&
		oldVehicle.nexttour[0]?.events &&
		oldVehicle.nexttour[0].events.length != 0
	) {
		await trx
			.updateTable('tour')
			.set({
				directDuration:
					oldVehicle?.prevtour &&
					oldVehicle.prevtour.length != 0 &&
					oldVehicle.prevtour[0]?.events &&
					oldVehicle.prevtour[0].events.length != 0
						? (
								await oneToManyCarRouting(
									oldVehicle.prevtour[0].events[0],
									[oldVehicle.nexttour[0].events[0]],
									false
								)
							)[0]
						: null
			})
			.where('id', '=', oldVehicle.nexttour[0].events[0].tour)
			.executeTakeFirst();
	}

	if (newVehicleId) {
		const newVehicle = vehicles[0].id === newVehicleId ? vehicles[0] : vehicles[1];
		const events = newVehicle.moved[0].events;
		events.sort((e) => e.scheduledTimeStart);
		await trx
			.updateTable('tour')
			.set({
				directDuration:
					newVehicle.prevtour != null && newVehicle.prevtour.length != 0
						? (await oneToManyCarRouting(newVehicle.prevtour[0].events[0], [events[0]], false))[0]
						: null
			})
			.where('id', '=', tourId)
			.executeTakeFirst();

		if (newVehicle.nexttour && newVehicle.nexttour.length != 0) {
			await trx
				.updateTable('tour')
				.set({
					directDuration:
						newVehicle.prevtour && newVehicle.prevtour.length != 0
							? (await oneToManyCarRouting(newVehicle.nexttour[0].events[0], [events[0]], true))[0]
							: null
				})
				.where('id', '=', newVehicle.nexttour[0].events[0].tour)
				.executeTakeFirst();
		}
	}
}
