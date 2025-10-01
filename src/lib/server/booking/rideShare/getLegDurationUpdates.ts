import { InsertWhat } from '$lib/util/booking/insertionTypes';
import type { RideShareEvent } from './getRideShareTours';
import type { Insertion } from './insertion';

export async function getLegDurationUpdates(
	prevPickupEvent: RideShareEvent | undefined,
	nextPickupEvent: RideShareEvent | undefined,
	prevDropoffEvent: RideShareEvent | undefined,
	nextDropoffEvent: RideShareEvent | undefined,
	pickupEventGroup: number | undefined,
	dropoffEventGroup: number | undefined,
	insertion: Insertion
) {
	const prevLegDurations: { event: number; duration: number | null }[] = [];
	const nextLegDurations: { event: number; duration: number | null }[] = [];

	function addLegDurationUpdate(
		neighbour: RideShareEvent | undefined,
		groupId: number | undefined,
		durationDifferentEventGroups: number,
		durationSameEventGroups: number | undefined,
		arr: { event: number; duration: number | null }[]
	) {
		if (neighbour) {
			if (neighbour.eventGroupId !== groupId) {
				arr.push({
					event: neighbour.eventId,
					duration: durationDifferentEventGroups
				});
			} else if (durationSameEventGroups !== undefined) {
				arr.push({
					event: neighbour.eventId,
					duration: durationSameEventGroups
				});
			}
		}
	}

	if (insertion.pickupCase.what === InsertWhat.BOTH) {
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
	} else {
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
	return { prevLegDurations, nextLegDurations };
}
