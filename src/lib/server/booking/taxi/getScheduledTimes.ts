import { PASSENGER_CHANGE_DURATION } from '$lib/constants';
import { Interval } from '$lib/util/interval';
import type { Event } from '$lib/server/booking/taxi/getBookingAvailability';
import type { DirectDrivingDurations } from './getDirectDrivingDurations';
import type { Insertion } from './insertion';
import { InsertWhat } from '$lib/util/booking/insertionTypes';

export type ScheduledTimes = {
	updates: {
		event_id: number;
		time: number;
		start: boolean;
	}[];
};

export function getScheduledTimes(
	insertion: Insertion,
	prevPickupEvent: undefined | (Event & { time: Interval }),
	nextPickupEvent: undefined | (Event & { time: Interval }),
	nextDropoffEvent: undefined | (Event & { time: Interval }),
	prevDropoffEvent: undefined | (Event & { time: Interval }),
	firstEvents: Event[],
	lastEvents: Event[],
	pickupEventGroup: number | undefined,
	dropoffEventGroup: number | undefined,
	directDurations: DirectDrivingDurations
) {
	function addUpdates(
		event: Event | undefined,
		duration: number,
		newStartTime: number,
		newEndTime: number,
		eventGroup: number | undefined,
		newEventIsEarlier: boolean
	) {
		if (event === undefined) {
			return;
		}
		if (event.eventGroupId === eventGroup) {
			scheduledTimes.updates.push({
				event_id: event.id,
				start: true,
				time: Math.max(newStartTime, event.scheduledTimeStart)
			});
			scheduledTimes.updates.push({
				event_id: event.id,
				start: false,
				time: Math.min(newEndTime, event.scheduledTimeEnd)
			});
			return;
		}
		const newTime = !newEventIsEarlier ? newStartTime : newEndTime;
		if (!event.time.shift(newEventIsEarlier ? -duration : duration).covers(newTime)) {
			return;
		}
		const newShiftedTime = newTime + (newEventIsEarlier ? duration : -duration);
		if (
			newEventIsEarlier
				? event.scheduledTimeEnd < newShiftedTime
				: event.scheduledTimeStart > newShiftedTime
		) {
			throw new Error(`Impossible update for event with id ${event.id} was requested.`);
		}
		scheduledTimes.updates.push({
			event_id: event.id,
			start: newEventIsEarlier,
			time: newShiftedTime
		});
	}

	const scheduledTimes: ScheduledTimes = {
		updates: []
	};
	const pickupPrevLegDuration =
		firstEvents.some((e) => e.id === nextPickupEvent?.id) &&
		insertion.pickupIdx &&
		lastEvents.some((e) => e.id === prevPickupEvent?.id)
			? Math.max(
					insertion.pickupPrevLegDuration,
					directDurations.thisTour?.directDrivingDuration ?? 0
				)
			: insertion.pickupPrevLegDuration;
	const dropoffNextLegDuration =
		firstEvents.some((e) => e.id === nextDropoffEvent?.id) &&
		insertion.dropoffIdx &&
		lastEvents.some((e) => e.id === prevDropoffEvent?.id)
			? Math.max(
					insertion.dropoffNextLegDuration,
					directDurations.nextTour?.directDrivingDuration ?? 0
				)
			: insertion.dropoffNextLegDuration;
	addUpdates(
		prevPickupEvent,
		pickupPrevLegDuration,
		insertion.scheduledPickupTimeStart,
		insertion.scheduledPickupTimeEnd,
		pickupEventGroup,
		false
	);
	if (insertion.pickupCase.what !== InsertWhat.BOTH) {
		addUpdates(
			nextPickupEvent,
			insertion.pickupNextLegDuration,
			insertion.scheduledPickupTimeStart,
			insertion.scheduledPickupTimeEnd,
			pickupEventGroup,
			true
		);
		addUpdates(
			prevDropoffEvent,
			insertion.dropoffPrevLegDuration,
			insertion.scheduledDropoffTimeStart,
			insertion.scheduledDropoffTimeEnd,
			dropoffEventGroup,
			false
		);
	}
	addUpdates(
		nextDropoffEvent,
		dropoffNextLegDuration,
		insertion.scheduledDropoffTimeStart,
		insertion.scheduledDropoffTimeEnd,
		dropoffEventGroup,
		true
	);
	for (let i = 0; i != firstEvents.length; ++i) {
		const earlierEvent = lastEvents[i];
		const laterEvent = firstEvents[i];
		const actualDistance =
			laterEvent.tourId === earlierEvent.tourId
				? laterEvent.prevLegDuration
				: laterEvent.directDuration;
		const startEarlierEvent =
			scheduledTimes.updates.find((upd) => upd.event_id === earlierEvent.id && upd.start === true)
				?.time ?? earlierEvent.scheduledTimeStart;
		const endEarlierEvent = earlierEvent.scheduledTimeEnd;
		const startLaterEvent = laterEvent.scheduledTimeStart;
		const leewayEarlierEvent = endEarlierEvent - startEarlierEvent;
		const scheduledDistance = startLaterEvent - endEarlierEvent;
		if (actualDistance === null || actualDistance + PASSENGER_CHANGE_DURATION < scheduledDistance) {
			return scheduledTimes;
		}
		const gap = actualDistance - scheduledDistance;
		if (leewayEarlierEvent < gap) {
			scheduledTimes.updates.push({
				event_id: earlierEvent.id,
				start: false,
				time: startEarlierEvent
			});
			scheduledTimes.updates.push({
				event_id: laterEvent.id,
				start: true,
				time: startLaterEvent + gap - leewayEarlierEvent
			});
		} else {
			scheduledTimes.updates.push({
				event_id: earlierEvent.id,
				start: false,
				time: endEarlierEvent - gap
			});
		}
	}
	return scheduledTimes;
}
