import { PASSENGER_CHANGE_DURATION } from '$lib/constants';
import { carRouting } from '$lib/util/carRouting';
import type { Event } from '$lib/server/booking/taxi/getBookingAvailability';
import type { Insertion } from './insertion';
import { InsertHow, InsertWhat } from '$lib/util/booking/insertionTypes';

export async function getLegDurationUpdates(
	firstEvents: Event[],
	lastEvents: Event[],
	prevPickupEvent: Event | undefined,
	nextPickupEvent: Event | undefined,
	prevDropoffEvent: Event | undefined,
	nextDropoffEvent: Event | undefined,
	pickupEventGroup: number | undefined,
	dropoffEventGroup: number | undefined,
	insertion: Insertion
) {
	const prevLegDurations: { event: number; duration: number | null }[] = [];
	const nextLegDurations: { event: number; duration: number | null }[] = [];
	const routing = firstEvents.map((e, i) => carRouting(lastEvents[i], e));
	const routingResults = await Promise.all(routing);
	const durations = routingResults.map((r) =>
		r?.duration ? r?.duration + PASSENGER_CHANGE_DURATION : null
	);
	durations.forEach((d, i) =>
		prevLegDurations.push({
			event: firstEvents[i].id,
			duration: d
		})
	);
	durations.forEach((d, i) =>
		nextLegDurations.push({
			event: lastEvents[i].id,
			duration: d
		})
	);

	function addLegDurationUpdate(
		neighbour: Event | undefined,
		groupId: number | undefined,
		durationDifferentEventGroups: number,
		durationSameEventGroups: number | undefined,
		arr: { event: number; duration: number | null }[]
	) {
		if (neighbour) {
			if (neighbour.eventGroupId !== groupId) {
				arr.push({
					event: neighbour.id,
					duration: durationDifferentEventGroups
				});
			} else if (durationSameEventGroups !== undefined) {
				arr.push({
					event: neighbour.id,
					duration: durationSameEventGroups
				});
			}
		}
	}

	if (insertion.pickupCase.what === InsertWhat.BOTH) {
		switch (insertion.pickupCase.how) {
			case InsertHow.APPEND:
				addLegDurationUpdate(
					prevPickupEvent,
					pickupEventGroup,
					insertion.pickupPrevLegDuration,
					insertion.dropoffPrevLegDuration,
					nextLegDurations
				);
				break;
			case InsertHow.PREPEND:
				addLegDurationUpdate(
					nextDropoffEvent,
					dropoffEventGroup,
					insertion.dropoffNextLegDuration,
					insertion.pickupNextLegDuration,
					prevLegDurations
				);
				break;
			default:
				addLegDurationUpdate(
					prevPickupEvent,
					pickupEventGroup,
					insertion.pickupPrevLegDuration,
					insertion.dropoffPrevLegDuration,
					nextLegDurations
				);
				addLegDurationUpdate(
					nextDropoffEvent,
					dropoffEventGroup,
					insertion.dropoffNextLegDuration,
					insertion.pickupNextLegDuration,
					prevLegDurations
				);
		}
	} else {
		switch (insertion.pickupCase.how) {
			case InsertHow.APPEND:
				addLegDurationUpdate(
					prevPickupEvent,
					pickupEventGroup,
					insertion.pickupPrevLegDuration,
					undefined,
					nextLegDurations
				);
				break;
			case InsertHow.PREPEND:
				addLegDurationUpdate(
					nextPickupEvent,
					pickupEventGroup,
					insertion.pickupNextLegDuration,
					undefined,
					prevLegDurations
				);
				break;
			default:
				addLegDurationUpdate(
					prevPickupEvent,
					pickupEventGroup,
					insertion.pickupPrevLegDuration,
					undefined,
					nextLegDurations
				);
				addLegDurationUpdate(
					nextPickupEvent,
					pickupEventGroup,
					insertion.pickupNextLegDuration,
					undefined,
					prevLegDurations
				);
		}
		switch (insertion.dropoffCase.how) {
			case InsertHow.APPEND:
				addLegDurationUpdate(
					prevDropoffEvent,
					dropoffEventGroup,
					insertion.dropoffPrevLegDuration,
					undefined,
					nextLegDurations
				);
				break;
			case InsertHow.PREPEND:
				addLegDurationUpdate(
					nextDropoffEvent,
					dropoffEventGroup,
					insertion.dropoffNextLegDuration,
					undefined,
					prevLegDurations
				);
				break;
			default:
				addLegDurationUpdate(
					prevDropoffEvent,
					dropoffEventGroup,
					insertion.dropoffPrevLegDuration,
					undefined,
					nextLegDurations
				);
				addLegDurationUpdate(
					nextDropoffEvent,
					dropoffEventGroup,
					insertion.dropoffNextLegDuration,
					undefined,
					prevLegDurations
				);
		}
	}
	return { prevLegDurations, nextLegDurations };
}
