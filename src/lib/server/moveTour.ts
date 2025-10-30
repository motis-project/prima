import { db } from '$lib/server/db';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { getPossibleInsertions } from '$lib/util/booking/getPossibleInsertions';
import { getLatestEventTime } from '$lib/util/getLatestEventTime';
import { sendNotifications } from '$lib/server/firebase/notifications.js';
import { TourChange } from '$lib/server/firebase/firebase';
import { getScheduledEventTime } from '$lib/util/getScheduledEventTime';
import { updateDirectDurations } from '$lib/server/booking/taxi/updateDirectDuration';
import { retry } from './db/retryQuery';

export async function moveTour(
	tourId: number,
	vehicleId: number,
	companyId: number
): Promise<{ status: number; message?: string }> {
	console.log('MOVE TOUR PARAMS: ', { tourId }, { vehicleId }, { companyId });
	let result: { status: number; message?: string } | undefined = undefined;
	await retry(() =>
		db
			.transaction()
			.setIsolationLevel('serializable')
			.execute(async (trx) => {
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
						'tour.vehicle',
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
									'request.id as requestId',
									'request.cancelled',
									jsonArrayFrom(
										eb
											.selectFrom('event')
											.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
											.whereRef('event.request', '=', 'request.id')
											.select([
												'eventGroup.scheduledTimeStart',
												'eventGroup.scheduledTimeEnd',
												'event.communicatedTime',
												'event.isPickup'
											])
									).as('events')
								])
						).as('requests')
					])
					.executeTakeFirst();
				if (!movedTour) {
					console.log('MOVE TOUR early exit - cannot find the tour to move. tourId: ', tourId);
					result = { status: 500, message: 'Die Tour konnte nicht gefunden werden.' };
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
						movedTour.requests.find((r) => r.events.length === 0)?.requestId
				);
				if (vehicleId === undefined) {
					console.log('MOVE TOUR early exit - no vehicle id was provided. tourId: ', tourId);
					result = { status: 400, message: 'Keine Fahrzeug-id angegeben' };
					return;
				}
				if (vehicleId === movedTour.vehicle) {
					result = { status: 400, message: 'Neue Fahrzeug-id stimmt mit alter überein.' };
					return;
				}
				const newVehicle = await trx
					.selectFrom('vehicle')
					.where('vehicle.id', '=', vehicleId)
					.select(['vehicle.bikes', 'vehicle.luggage', 'vehicle.wheelchairs', 'vehicle.passengers'])
					.executeTakeFirst();
				if (!newVehicle) {
					console.log(
						'MOVE TOUR early exit - cannot find the vehicle, the tour is supposed to be moved to, in the database. tourId: ',
						tourId
					);
					result = { status: 400, message: 'Das Zielfahrzeug konnte nicht gefunden werden.' };
					return;
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
					console.log(
						'MOVE TOUR early exit - target vehicle has insufficient capacity on at least one of the legs of the tour. tourId: ',
						tourId,
						', vehicleId: ',
						vehicleId
					);
					result = {
						status: 400,
						message:
							'Das Zielfahrzeug verfügt nicht über ausreichende Kapazität um die Tour zu fahren.'
					};
					return;
				}

				const firstEventTime = Math.min(...events.map((e) => getLatestEventTime(e)));
				if (firstEventTime < Date.now()) {
					console.log(
						'MOVE TOUR early exit - tour may not be moved since the first event is already in the past. tourId: ',
						tourId
					);
					result = {
						status: 400,
						message:
							'Touren können nicht mehr auf andere Fahrzeuge verschoben werden, wenn der erste Kunde nach Zeitplan bereits eingesammelt wurde.'
					};
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
				if (collidingTours.length !== 0) {
					console.log(
						'MOVE TOUR early exit - there is a collision with another tour of the target vehicle. tourId: ',
						tourId
					);
					return;
				}
				await trx
					.updateTable('tour')
					.set({ vehicle: vehicleId })
					.where('id', '=', tourId)
					.executeTakeFirst();
				const requestIds = movedTour.requests.filter((r) => !r.cancelled).map((r) => r.requestId);
				if (requestIds.length !== 0) {
					await trx
						.updateTable('request')
						.set({ licensePlateUpdatedAt: Date.now() })
						.where('request.id', 'in', requestIds)
						.execute();
				}
				const firstEvent = movedTour.requests
					.sort((r) => r.events[0].scheduledTimeStart)[0]
					.events.filter((e) => e.isPickup)[0];
				const wheelchairs = movedTour.requests.reduce((prev, curr) => prev + curr.wheelchairs, 0);
				await sendNotifications(companyId, {
					tourId,
					pickupTime: getScheduledEventTime(firstEvent),
					vehicleId,
					wheelchairs,
					change: TourChange.MOVED
				});
				await updateDirectDurations(
					movedTour.vehicle,
					movedTour.id,
					movedTour.departure,
					trx,
					vehicleId
				);
			})
	);
	return result ?? { status: 200 };
}
