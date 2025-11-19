import { db } from '$lib/server/db';
import { getRideShareTourByRequest, type RideShareEvent } from './getRideShareTours';
import { retry } from '$lib/server/db/retryQuery';
import { evaluateRequest } from './evaluateRequest';
import { sql } from 'kysely';
import type { Insertion } from './insertion';
import { getScheduledTimes } from './getScheduledTimes';
import type { Coordinates } from '$lib/util/Coordinates';
import { Interval } from '$lib/util/interval';
import { isSamePlace } from '../isSamePlace';

export async function acceptRideShareRequest(requestId: number, provider: number) {
	console.log('ACCPECT RIDE SHARE REQUEST PARAMS:', { requestId, provider });
	let message = 'success';
	let status = 200;
	await retry(() =>
		db
			.transaction()
			.setIsolationLevel('serializable')
			.execute(async (trx) => {
				const tours = await getRideShareTourByRequest(requestId, trx);
				if (tours.length === 0) {
					status = 500;
					message = 'Could not find ride share tour when trying to set pending to true';
					return;
				}
				const tour = tours[0];
				if (tour.owner !== provider) {
					status = 403;
					message = 'Attempt to alter pending in a tour of someone else';
					return;
				}
				const newEvents = tour.events.filter((e) => e.requestId === requestId);
				const newPickup = newEvents.find((e) => e.isPickup)!;
				const newDropoff = newEvents.find((e) => !e.isPickup)!;
				const startFixed = newPickup.startFixed!;
				const userChosen = startFixed ? newDropoff : newPickup;
				const b = !startFixed ? newDropoff : newPickup;
				const busStop = { ...b, times: [b.busStopTime!] };
				const best = (
					await evaluateRequest(
						tours.map((t) => {
							return { ...t, requests: t.requests.filter((r) => r.pending === false) };
						}),
						userChosen,
						[busStop],
						{ ...newPickup, wheelchairs: 0, bikes: 0 },
						startFixed,
						{
							pickup: newPickup.communicatedTime,
							dropoff: newDropoff.communicatedTime,
							tourId: tour.rideShareTour
						}
					)
				)[0][0][0];
				if (best === undefined) {
					status = 404;
					message = 'The ride share tour is no longer valid';
					return;
				}
				const durationUpdates = getDurationUpdates(best);
				const events = tour.events;
				const prevPickupEvent = events[events.findIndex((e) => e.requestId === requestId) - 1];
				const nextPickupEvent = events[events.findLastIndex((e) => e.requestId === requestId) + 1];
				const prevDropoffEvent = events[events.findIndex((e) => e.requestId === requestId) - 1];
				const nextDropoffEvent = events[events.findLastIndex((e) => e.requestId === requestId) + 1];
				let pickupEventGroup = undefined;
				let dropoffEventGroup = undefined;
				const pickupInterval = new Interval(
					best.scheduledPickupTimeStart,
					best.scheduledPickupTimeEnd
				);
				const dropoffInterval = new Interval(
					best.scheduledDropoffTimeStart,
					best.scheduledDropoffTimeEnd
				);
				if (belongToSameEventGroup(prevPickupEvent, newPickup, pickupInterval)) {
					pickupEventGroup = prevPickupEvent!.eventGroupId;
				}
				if (belongToSameEventGroup(nextPickupEvent, newPickup, pickupInterval)) {
					pickupEventGroup = nextPickupEvent!.eventGroupId;
				}
				if (belongToSameEventGroup(prevDropoffEvent, newDropoff, dropoffInterval)) {
					dropoffEventGroup = prevDropoffEvent!.eventGroupId;
				}
				if (belongToSameEventGroup(nextDropoffEvent, newDropoff, dropoffInterval)) {
					dropoffEventGroup = nextDropoffEvent!.eventGroupId;
				}

				const scheduledTimes = getScheduledTimes(
					best,
					prevPickupEvent,
					nextPickupEvent,
					nextDropoffEvent,
					prevDropoffEvent,
					pickupEventGroup,
					dropoffEventGroup
				);
				const additionalScheduledTimes = new Array<{
					event_id: number;
					time: number;
					start: boolean;
				}>();
				scheduledTimes.updates.forEach((update) => {
					const firstIdx = events.findIndex((e) => e.eventId === update.event_id);
					const lastIdx = events.findLastIndex((e) => e.eventId === update.event_id);
					const sameEventGroup = events.slice(firstIdx, lastIdx + 1);
					sameEventGroup.forEach((event) => {
						if (event.eventId === update.event_id) {
							return;
						}
						additionalScheduledTimes.push({ ...update, event_id: event.eventId });
					});
				});
				scheduledTimes.updates = scheduledTimes.updates.concat(additionalScheduledTimes);

				await sql<{ request: number }>`
				CALL accept_ride_share_request(
				  ${requestId},
				  ROW(${true}, ${newPickup.lat}, ${newPickup.lng}, ${best.scheduledPickupTimeStart}, ${best.scheduledPickupTimeEnd}, ${best.pickupTime}, ${best.pickupPrevLegDuration}, ${best.pickupNextLegDuration}, '', ${pickupEventGroup ?? null})::event_type,
				  ROW(${false}, ${newDropoff.lat}, ${newDropoff.lng}, ${best.scheduledDropoffTimeStart}, ${best.scheduledDropoffTimeEnd}, ${best.dropoffTime}, ${best.dropoffPrevLegDuration}, ${best.dropoffNextLegDuration}, '', ${dropoffEventGroup ?? null})::event_type,
				  ${newPickup.eventId},
				  ${newDropoff.eventId},
				  ${JSON.stringify(scheduledTimes.updates)}::jsonb,
				  ${JSON.stringify(durationUpdates.prevLegUpdates)}::jsonb,
				  ${JSON.stringify(durationUpdates.nextLegUpdates)}::jsonb
				)`.execute(trx);
			})
	);
	return { status, message };
}

function getDurationUpdates(i: Insertion) {
	const nextLegUpdates = [{ event: i.prevPickupId, duration: i.pickupPrevLegDuration }];
	if (i.prevDropoffId !== i.prevPickupId) {
		nextLegUpdates.push({
			event: i.prevDropoffId,
			duration: i.dropoffPrevLegDuration
		});
	}
	const prevLegUpdates = [{ event: i.nextDropoffId, duration: i.dropoffNextLegDuration }];
	if (i.nextDropoffId !== i.nextPickupId) {
		prevLegUpdates.push({
			event: i.nextPickupId,
			duration: i.pickupNextLegDuration
		});
	}
	return { prevLegUpdates, nextLegUpdates };
}

function belongToSameEventGroup(
	event: RideShareEvent | undefined,
	otherEventCoordinates: Coordinates,
	otherEventInterval: Interval
) {
	return (
		event !== undefined &&
		isSamePlace(event, otherEventCoordinates) &&
		(otherEventInterval.overlaps(event.time) ||
			otherEventInterval.touches(event.time) ||
			otherEventInterval.equals(event.time))
	);
}
