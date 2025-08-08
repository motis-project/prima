import type { Transaction } from 'kysely';
import { type Database } from '$lib/server/db';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import { oneToManyCarRouting } from '../util/oneToManyCarRouting';
import { PASSENGER_CHANGE_DURATION } from '$lib/constants';

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
			jsonObjectFrom(
				eb
					.selectFrom('tour')
					.innerJoin('request', 'request.tour', 'tour.id')
					.innerJoin('event', 'event.request', 'request.id')
					.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
					.whereRef('tour.vehicle', '=', 'vehicle.id')
					.where('tour.cancelled', '=', false)
					.where('tour.departure', '<=', departure)
					.where('request.cancelled', '=', false)
					.orderBy('tour.departure', 'desc')
					.orderBy('eventGroup.scheduledTimeEnd', 'desc')
					.orderBy('eventGroup.scheduledTimeStart', 'desc')
					.limit(1)
					.select([
						'eventGroup.lat',
						'eventGroup.lng',
						'request.tour',
						'eventGroup.scheduledTimeStart'
					])
			).as('prevtour'),
			jsonObjectFrom(
				eb
					.selectFrom('tour')
					.innerJoin('request', 'request.tour', 'tour.id')
					.innerJoin('event', 'event.request', 'request.id')
					.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
					.whereRef('tour.vehicle', '=', 'vehicle.id')
					.where('tour.cancelled', '=', false)
					.where('tour.departure', '>', departure)
					.where('request.cancelled', '=', false)
					.orderBy('tour.departure', 'asc')
					.orderBy('eventGroup.scheduledTimeEnd', 'asc')
					.orderBy('eventGroup.scheduledTimeStart', 'asc')
					.limit(1)
					.select([
						'eventGroup.lat',
						'eventGroup.lng',
						'request.tour',
						'eventGroup.scheduledTimeStart'
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
								.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
								.where('request.cancelled', '=', false)
								.whereRef('request.tour', '=', 'tour.id')
								.orderBy('eventGroup.scheduledTimeEnd', 'asc')
								.orderBy('eventGroup.scheduledTimeStart', 'asc')
								.select(['eventGroup.lat', 'eventGroup.lng', 'eventGroup.scheduledTimeStart'])
						).as('events')
					])
			).as('moved')
		])
		.execute();

	const oldVehicle = vehicles[0].id === oldVehicleId ? vehicles[0] : vehicles[1];
	if (oldVehicle.nexttour) {
		const routingResult = oldVehicle?.prevtour
			? ((await oneToManyCarRouting(oldVehicle.prevtour, [oldVehicle.nexttour], false)) ?? null)
			: null;
		await trx
			.updateTable('tour')
			.set({
				directDuration: routingResult
					? routingResult[0] === undefined
						? null
						: routingResult[0] + PASSENGER_CHANGE_DURATION
					: null
			})
			.where('id', '=', oldVehicle.nexttour.tour)
			.executeTakeFirst();
	}

	if (newVehicleId) {
		const newVehicle = vehicles[0].id === newVehicleId ? vehicles[0] : vehicles[1];
		const events = newVehicle.moved[0].events;
		events.sort((e) => e.scheduledTimeStart);
		const routingResultPrevTour = newVehicle?.prevtour
			? ((await oneToManyCarRouting(newVehicle.prevtour, [events[0]], false)) ?? null)
			: null;
		await trx
			.updateTable('tour')
			.set({
				directDuration: routingResultPrevTour
					? routingResultPrevTour[0] === undefined
						? null
						: routingResultPrevTour[0] + PASSENGER_CHANGE_DURATION
					: null
			})
			.where('id', '=', tourId)
			.executeTakeFirst();

		if (newVehicle.nexttour) {
			const routingResultNextTour = newVehicle.nexttour
				? ((await oneToManyCarRouting(events[events.length - 1], [newVehicle.nexttour], false)) ??
					null)
				: null;
			await trx
				.updateTable('tour')
				.set({
					directDuration: routingResultNextTour
						? routingResultNextTour[0] === undefined
							? null
							: routingResultNextTour[0] + PASSENGER_CHANGE_DURATION
						: null
				})
				.where('id', '=', newVehicle.nexttour.tour)
				.executeTakeFirst();
		}
	}
}
