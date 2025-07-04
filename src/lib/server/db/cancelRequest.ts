import { sql, Transaction } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { sendMail } from '$lib/server/sendMail';
import CancelNotificationCompany from '$lib/server/email/CancelNotificationCompany.svelte';
import { getScheduledEventTime } from '$lib/util/getScheduledEventTime';
import { sendNotifications } from '../firebase/notifications';
import { TourChange } from '$lib/server/firebase/firebase';
import { updateDirectDurations } from '$lib/server/booking/updateDirectDuration';
import { db, type Database } from '$lib/server/db';
import { oneToManyCarRouting } from '$lib/server/util/oneToManyCarRouting';
import { retry } from './retryQuery';
import { PASSENGER_CHANGE_DURATION } from '$lib/constants';

export const cancelRequest = async (requestId: number, userId: number) => {
	console.log(
		'Cancel Request PARAMS START: ',
		JSON.stringify({ requestId, userId }, null, '\t'),
		' Cancel Request PARAMS END'
	);
	await retry(() =>
		db.transaction().execute(async (trx) => {
			const tour = await trx
				.selectFrom('request')
				.where('request.id', '=', requestId)
				.innerJoin('tour as relevant_tour', 'relevant_tour.id', 'request.tour')
				.select((eb) => [
					'relevant_tour.id as tourId',
					'request.ticketChecked',
					jsonArrayFrom(
						eb
							.selectFrom('request as cancelled_request')
							.where('cancelled_request.id', '=', requestId)
							.innerJoin('tour as relevant_tour', 'cancelled_request.tour', 'relevant_tour.id')
							.innerJoin('request as relevant_request', 'relevant_request.tour', 'relevant_tour.id')
							.select((eb) => [
								'relevant_request.wheelchairs',
								jsonArrayFrom(
									eb
										.selectFrom('event')
										.whereRef('event.request', '=', 'relevant_request.id')
										.select([
											'event.scheduledTimeStart',
											'event.scheduledTimeEnd',
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
					'Cancel Request early exit - cannot find tour associated with requestId in db. ',
					{ requestId, userId }
				);
				return;
			}
			if (tour.ticketChecked === true) {
				console.log('Cancel Request early exit - cannot cancel request, ticket was checked. ', {
					requestId,
					userId
				});
				return;
			}
			const queryResult = await sql<{
				wastourcancelled: boolean;
			}>`SELECT cancel_request(${requestId}, ${userId}, ${Date.now()}) AS wasTourCancelled`.execute(
				trx
			);
			const tourInfo = await trx
				.selectFrom('request as cancelled_request')
				.where('cancelled_request.id', '=', requestId)
				.innerJoin('tour', 'tour.id', 'cancelled_request.tour')
				.select((eb) => [
					'cancelled_request.ticketChecked',
					'cancelled_request.cancelled as wasRequestCancelled',
					'tour.vehicle',
					'tour.id',
					'tour.departure',
					'tour.vehicle',
					jsonArrayFrom(
						eb
							.selectFrom('request as cancelled_request')
							.innerJoin('tour as cancelled_tour', 'cancelled_tour.id', 'cancelled_request.tour')
							.innerJoin('request', 'request.tour', 'cancelled_tour.id')
							.innerJoin('event', 'event.request', 'request.id')
							.where('cancelled_request.id', '=', requestId)
							.select([
								'event.address',
								'event.scheduledTimeStart',
								'event.scheduledTimeEnd',
								'event.cancelled',
								'event.lat',
								'event.lng',
								'request.id as requestid',
								'cancelled_tour.id as tourid',
								'event.id as eventid'
							])
					).as('events'),
					jsonArrayFrom(
						eb
							.selectFrom('request')
							.innerJoin('tour', 'tour.id', 'request.tour')
							.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
							.innerJoin('company', 'company.id', 'vehicle.company')
							.innerJoin('user', 'user.companyId', 'company.id')
							.where('request.id', '=', requestId)
							.where('user.isTaxiOwner', '=', true)
							.select([
								'user.name',
								'user.email',
								'company.lat',
								'company.lng',
								'company.id as companyId'
							])
					).as('companyOwners')
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
				console.log(
					'The request could not be cancelled due to time constraints or missing authorization.'
				);
				return;
			}
			console.assert(queryResult.rows.length === 1);
			if (queryResult.rows[0].wastourcancelled) {
				await updateDirectDurations(tourInfo.vehicle, tourInfo.id, tourInfo.departure, trx);
			} else {
				await updateLegDurations(
					tourInfo.events,
					{ lat: tourInfo.companyOwners[0].lat!, lng: tourInfo.companyOwners[0].lng! },
					requestId,
					tourInfo.vehicle,
					trx
				);
			}
			for (const companyOwner of tourInfo.companyOwners) {
				try {
					await sendMail(CancelNotificationCompany, 'Stornierte Buchung', companyOwner.email, {
						events: tourInfo.events,
						name: companyOwner.name,
						departure: tourInfo.departure
					});
				} catch {
					console.log(
						'Failed to send cancellation email to company with email: ',
						companyOwner.email,
						' tourId: ',
						tourInfo.id
					);
				}
			}
			const firstEvent = tour.requests
				.flatMap((r) => r.events)
				.sort((e) => e.scheduledTimeStart)[0];
			const wheelchairs = tour.requests.reduce((prev, curr) => prev + curr.wheelchairs, 0);
			if (firstEvent.requestId === requestId && tourInfo.companyOwners.length !== 0) {
				await sendNotifications(tourInfo.companyOwners[0].companyId, {
					tourId: tour.tourId,
					pickupTime: getScheduledEventTime(firstEvent),
					vehicleId: tourInfo.vehicle,
					wheelchairs,
					change: TourChange.CANCELLED
				});
			}

			console.log('Cancel Request - success', { requestId, userId });
		})
	);
};

async function updateLegDurations(
	events: {
		cancelled: boolean;
		scheduledTimeStart: number;
		scheduledTimeEnd: number;
		lat: number;
		lng: number;
		requestid: number;
		tourid: number;
		eventid: number;
	}[],
	company: maplibregl.LngLatLike,
	requestId: number,
	vehicleId: number,
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
		}[],
		company: maplibregl.LngLatLike,
		trx: Transaction<Database>
	) => {
		if (prevIdx === -1) {
			const routingResultFirstEvent =
				(await oneToManyCarRouting(company, [events[nextIdx]], false))[0] ??
				(await oneToManyCarRouting(events[nextIdx], [company], true))[0];
			if (routingResultFirstEvent === undefined) {
				console.log(
					`unable to update prevLegDuration for event ${events[nextIdx].eventid}, routing result was undefined.`
				);
				throw new Error();
			}
			await trx
				.updateTable('event')
				.set({ prevLegDuration: routingResultFirstEvent })
				.where('event.id', '=', events[nextIdx].eventid)
				.executeTakeFirst();
			return;
		}
		if (nextIdx === events.length) {
			const routingResultLastEvent =
				(await oneToManyCarRouting(events[prevIdx], [company], false))[0] ??
				(await oneToManyCarRouting(company, [events[prevIdx]], true))[0];
			if (routingResultLastEvent === undefined) {
				console.log(
					`unable to update prevLegDuration for event ${events[prevIdx].eventid}, routing result was undefined.`
				);
				throw new Error();
			}
			await trx
				.updateTable('event')
				.set({ nextLegDuration: routingResultLastEvent + PASSENGER_CHANGE_DURATION })
				.where('event.id', '=', events[prevIdx].eventid)
				.executeTakeFirst();
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
			.updateTable('event')
			.set({ nextLegDuration: r })
			.where('event.id', '=', events[prevIdx].eventid)
			.executeTakeFirst();
		await trx
			.updateTable('event')
			.set({ prevLegDuration: r })
			.where('event.id', '=', events[nextIdx].eventid)
			.executeTakeFirst();
	};

	const uncancelledEvents = events
		.filter((e) => e.requestid === requestId || e.cancelled === false)
		.sort((e1, e2) => e1.scheduledTimeStart - e2.scheduledTimeStart);
	const cancelledIdx1 = uncancelledEvents.findIndex((e) => e.requestid === requestId);
	const cancelledIdx2 = uncancelledEvents.findLastIndex((e) => e.requestid === requestId);
	const cancelledEvent1 = uncancelledEvents[cancelledIdx1];
	const cancelledEvent2 = uncancelledEvents[cancelledIdx2];
	console.assert(
		cancelledIdx1 != -1 && cancelledIdx2 != -1 && cancelledIdx1 < cancelledIdx2,
		'Invalid cancelledIdx in cancelRequest.ts',
		{ cancelled1Idx: cancelledIdx1 },
		{ cancelled2Idx: cancelledIdx2 }
	);
	if (cancelledIdx1 === cancelledIdx2 - 1) {
		await update(cancelledIdx1 - 1, cancelledIdx2 + 1, uncancelledEvents, company, trx);
	} else {
		await update(cancelledIdx1 - 1, cancelledIdx1 + 1, uncancelledEvents, company, trx);
		await update(cancelledIdx2 - 1, cancelledIdx2 + 1, uncancelledEvents, company, trx);
	}

	if (cancelledIdx1 === 0 && uncancelledEvents.length > 2) {
		const lastEventPrevTour = await trx
			.selectFrom('tour')
			.innerJoin('request', 'request.tour', 'tour.id')
			.innerJoin('event', 'event.request', 'request.id')
			.where('event.cancelled', '=', false)
			.where('event.scheduledTimeStart', '<', cancelledEvent1.scheduledTimeStart)
			.where('tour.vehicle', '=', vehicleId)
			.orderBy('event.scheduledTimeEnd', 'desc')
			.limit(1)
			.select(['event.lat', 'event.lng', 'event.id'])
			.executeTakeFirst();
		const firstUncancelledEvent = uncancelledEvents[cancelledIdx2 === 1 ? 2 : 1];
		if (lastEventPrevTour) {
			const routing =
				(await oneToManyCarRouting(lastEventPrevTour, [firstUncancelledEvent], false))[0] ??
				(await oneToManyCarRouting(firstUncancelledEvent, [lastEventPrevTour], true))[0];
			await trx
				.updateTable('tour')
				.set({
					directDuration: routing === undefined ? null : routing + PASSENGER_CHANGE_DURATION
				})
				.where('tour.id', '=', firstUncancelledEvent.tourid)
				.execute();
		}
	}
	if (cancelledIdx2 === uncancelledEvents.length - 1 && uncancelledEvents.length > 2) {
		const firstEventNextTour = await trx
			.selectFrom('tour')
			.innerJoin('request', 'request.tour', 'tour.id')
			.innerJoin('event', 'event.request', 'request.id')
			.where('event.cancelled', '=', false)
			.where('event.scheduledTimeEnd', '>', cancelledEvent2.scheduledTimeEnd)
			.where('tour.vehicle', '=', vehicleId)
			.orderBy('event.scheduledTimeEnd', 'asc')
			.limit(1)
			.select(['event.lat', 'event.lng', 'event.id', 'tour.id as tourId'])
			.executeTakeFirst();
		const lastUncancelledEvent =
			uncancelledEvents[
				uncancelledEvents.length - (cancelledIdx1 === uncancelledEvents.length - 2 ? 3 : 2)
			];
		if (firstEventNextTour) {
			const routing =
				(await oneToManyCarRouting(lastUncancelledEvent, [firstEventNextTour], false))[0] ??
				(await oneToManyCarRouting(firstEventNextTour, [lastUncancelledEvent], true))[0];
			await trx
				.updateTable('tour')
				.set({
					directDuration: routing === undefined ? null : routing + PASSENGER_CHANGE_DURATION
				})
				.where('tour.id', '=', firstEventNextTour.tourId)
				.execute();
		}
	}
}
