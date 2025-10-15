import { sql, Transaction } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { sendMail } from '$lib/server/sendMail';
import CancelNotificationCompany from '$lib/server/email/CancelNotificationCompany.svelte';
import { db, type Database } from '$lib/server/db';
import { oneToManyCarRouting } from '$lib/server/util/oneToManyCarRouting';
import { PASSENGER_CHANGE_DURATION } from '$lib/constants';
import { sortEventsByTime } from '$lib/testHelpers';
import { retry } from '$lib/server/db/retryQuery';

export const cancelRideShareRequest = async (requestId: number, userId: number) => {
	console.log(
		'Cancel Request PARAMS START: ',
		JSON.stringify({ requestId, userId }, null, '\t'),
		' Cancel Request PARAMS END'
	);
	await retry(() =>
		db
			.transaction()
			.setIsolationLevel('serializable')
			.execute(async (trx) => {
				const tour = await trx
					.selectFrom('request')
					.where('request.id', '=', requestId)
					.innerJoin('rideShareTour as relevant_tour', 'relevant_tour.id', 'request.rideShareTour')
					.select((eb) => [
						'relevant_tour.id as tourId',
						jsonArrayFrom(
							eb
								.selectFrom('request as cancelled_request')
								.where('cancelled_request.id', '=', requestId)
								.innerJoin(
									'rideShareTour as relevant_tour',
									'cancelled_request.rideShareTour',
									'relevant_tour.id'
								)
								.innerJoin(
									'request as relevant_request',
									'relevant_request.tour',
									'relevant_tour.id'
								)
								.select((eb) => [
									jsonArrayFrom(
										eb
											.selectFrom('event')
											.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
											.whereRef('event.request', '=', 'relevant_request.id')
											.select([
												'eventGroup.scheduledTimeStart',
												'eventGroup.scheduledTimeEnd',
												'event.isPickup',
												'event.request as requestId'
											])
									).as('events')
								])
						).as('requests')
					])
					.executeTakeFirst();
				if (tour === undefined) {
					console.log(
						'Cancel Ride Share Request early exit - cannot find tour associated with requestId in db. ',
						{ requestId, userId }
					);
					return;
				}
				const queryResult =
					await sql`CALL cancel_ride_share_request(${requestId}, ${userId})`.execute(trx);
				const tourInfo = await trx
					.selectFrom('request as cancelled_request')
					.where('cancelled_request.id', '=', requestId)
					.innerJoin('rideShareTour', 'rideShareTour.id', 'cancelled_request.rideShareTour')
					.innerJoin('rideShareVehicle', 'rideShareTour.vehicle', 'rideShareVehicle.id')
					.innerJoin('user', 'user.id', 'rideShareVehicle.owner')
					.select((eb) => [
						'cancelled_request.cancelled as wasRequestCancelled',
						'rideShareTour.vehicle',
						'rideShareTour.id',
						'user.name',
						'user.email',
						'cancelled_request.pending',
						jsonArrayFrom(
							eb
								.selectFrom('request as cancelled_request')
								.innerJoin(
									'rideShareTour as cancelled_tour',
									'cancelled_tour.id',
									'cancelled_request.rideShareTour'
								)
								.innerJoin('request', 'request.rideShareTour', 'cancelled_tour.id')
								.innerJoin('event', 'event.request', 'request.id')
								.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
								.where('cancelled_request.id', '=', requestId)
								.select([
									'eventGroup.address',
									'eventGroup.scheduledTimeStart',
									'eventGroup.scheduledTimeEnd',
									'event.cancelled',
									'eventGroup.prevLegDuration',
									'eventGroup.nextLegDuration',
									'eventGroup.lat',
									'eventGroup.lng',
									'request.id as requestid',
									'cancelled_tour.id as tourid',
									'event.id as eventid',
									'event.eventGroupId',
									'request.pending'
								])
						).as('events')
					])
					.executeTakeFirst();
				if (tourInfo === undefined) {
					console.log(
						'Tour was undefined unexpectedly in cancelRequest cannot send notification Emails, requestId: ',
						requestId
					);
					return;
				}
				if (!tourInfo.wasRequestCancelled) {
					console.log('The request could not be cancelled due to missing authorization.');
					return;
				}
				console.assert(queryResult.rows.length === 1);
				if (!tourInfo.pending) {
					await updateLegDurations(tourInfo.events, requestId, trx);
				}
				try {
					await sendMail(CancelNotificationCompany, 'Stornierte Buchung', tourInfo.email, {
						events: tourInfo.events,
						name: tourInfo.name
					});
				} catch {
					console.log(
						'Failed to send cancellation email to company with email: ',
						tourInfo.email,
						' tourId: ',
						tourInfo.id
					);
				}
				console.log('Cancel Ride Share Request - success', { requestId, userId });
			})
	);
};

async function updateLegDurations(
	events: {
		cancelled: boolean;
		scheduledTimeStart: number;
		scheduledTimeEnd: number;
		prevLegDuration: number;
		nextLegDuration: number;
		lat: number;
		lng: number;
		requestid: number;
		tourid: number;
		eventid: number;
		eventGroupId: number;
		pending: boolean;
	}[],
	requestId: number,
	trx: Transaction<Database>
) {
	const update = async (
		prevIdx: number,
		nextIdx: number,
		events: {
			cancelled: boolean;
			scheduledTimeStart: number;
			scheduledTimeEnd: number;
			lat: number;
			lng: number;
			requestid: number;
			tourid: number;
			eventid: number;
			eventGroupId: number;
			pending: boolean;
		}[],
		trx: Transaction<Database>
	) => {
		if (prevIdx === -1 || nextIdx === events.length) {
			return;
		}
		const routingResult =
			(await oneToManyCarRouting(events[prevIdx], [events[nextIdx]], false))[0] ??
			(await oneToManyCarRouting(events[nextIdx], [events[prevIdx]], true))[0];
		if (routingResult === undefined) {
			console.log(
				`unable to update prevLegDuration for event ${events[prevIdx].eventid} and nextLegDuration for event ${events[nextIdx].eventid}, routing result was undefined.`
			);
			throw new Error();
		}
		const r = routingResult + PASSENGER_CHANGE_DURATION;
		await trx
			.updateTable('eventGroup')
			.set({ nextLegDuration: r })
			.where('eventGroup.id', '=', events[prevIdx].eventGroupId)
			.executeTakeFirst();
		await trx
			.updateTable('eventGroup')
			.set({ prevLegDuration: r })
			.where('eventGroup.id', '=', events[nextIdx].eventGroupId)
			.executeTakeFirst();
	};

	const uncancelledEvents = sortEventsByTime(
		events.filter((e) => (e.requestid === requestId || !e.cancelled) && !e.pending)
	);
	const cancelledIdx1 = uncancelledEvents.findIndex((e) => e.requestid === requestId);
	const cancelledIdx2 = uncancelledEvents.findLastIndex((e) => e.requestid === requestId);
	console.assert(
		cancelledIdx1 != -1 && cancelledIdx2 != -1 && cancelledIdx1 < cancelledIdx2,
		'Invalid cancelledIdx in cancelRequest.ts',
		{ cancelledIdx1 },
		{ cancelledIdx2 }
	);
	if (cancelledIdx1 === cancelledIdx2 - 1) {
		await update(cancelledIdx1 - 1, cancelledIdx2 + 1, uncancelledEvents, trx);
	} else {
		await update(cancelledIdx1 - 1, cancelledIdx1 + 1, uncancelledEvents, trx);
		await update(cancelledIdx2 - 1, cancelledIdx2 + 1, uncancelledEvents, trx);
	}
}
