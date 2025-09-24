import { Interval } from '$lib/util/interval';
import { InsertWhat } from '$lib/util/booking/insertionTypes';
import type { RideShareEvent } from './getRideShareTours';
import type { Insertion } from './insertion';

export type ScheduledTimes = {
	updates: {
		event_id: number;
		time: number;
		start: boolean;
	}[];
};

export function getScheduledTimes(
	insertion: Insertion,
	prevPickupEvent: undefined | (RideShareEvent & { time: Interval }),
	nextPickupEvent: undefined | (RideShareEvent & { time: Interval }),
	nextDropoffEvent: undefined | (RideShareEvent & { time: Interval }),
	prevDropoffEvent: undefined | (RideShareEvent & { time: Interval }),
	pickupEventGroup: number | undefined,
	dropoffEventGroup: number | undefined
) {
	function addUpdates(
		event: RideShareEvent | undefined,
		duration: number,
		newStartTime: number,
		newEndTime: number,
		eventGroup: number | undefined,
		isPickup: boolean
	) {
		if (event === undefined) {
			return;
		}
		if (event.eventGroupId === eventGroup) {
			scheduledTimes.updates.push({
				event_id: event.eventId,
				start: true,
				time: Math.max(newStartTime, event.scheduledTimeStart)
			});
			scheduledTimes.updates.push({
				event_id: event.eventId,
				start: false,
				time: Math.min(newEndTime, event.scheduledTimeEnd)
			});
			return;
		}
		const newTime = isPickup ? newStartTime : newEndTime;
		if (!event.time.shift(!isPickup ? -duration : duration).covers(newTime)) {
			return;
		}
		const oldTime = isPickup ? event.scheduledTimeStart : event.scheduledTimeEnd;
		const leeway = (isPickup ? newTime - oldTime : oldTime - newTime) - duration;
		const newShiftedTime = newTime + (isPickup ? -duration : duration);
		console.log({ oldTime }, { leeway }, { duration }, { isPickup });
		if (leeway < 0) {
			console.log(
				'leeway was less than zero in getScheduledTimes',
				{ event },
				{ duration },
				{ newTime: newTime },
				{ eventGroup },
				{ isPickup }
			);
			throw new Error('leeway was less than zero in getScheduledTimes');
		}
		if (leeway < event.time.size()) {
			scheduledTimes.updates.push({
				event_id: event.eventId,
				start: !isPickup,
				time: newShiftedTime
			});
		}
	}

	const scheduledTimes: ScheduledTimes = {
		updates: []
	};
	const pickupPrevLegDuration = insertion.pickupPrevLegDuration;
	const dropoffNextLegDuration = insertion.dropoffNextLegDuration;
	addUpdates(
		prevPickupEvent,
		pickupPrevLegDuration,
		insertion.scheduledPickupTimeStart,
		insertion.scheduledPickupTimeEnd,
		pickupEventGroup,
		true
	);
	if (insertion.pickupCase.what !== InsertWhat.BOTH) {
		addUpdates(
			nextPickupEvent,
			insertion.pickupNextLegDuration,
			insertion.scheduledPickupTimeStart,
			insertion.scheduledPickupTimeEnd,
			pickupEventGroup,
			false
		);
		addUpdates(
			prevDropoffEvent,
			insertion.dropoffPrevLegDuration,
			insertion.scheduledDropoffTimeStart,
			insertion.scheduledDropoffTimeEnd,
			dropoffEventGroup,
			true
		);
	}
	addUpdates(
		nextDropoffEvent,
		dropoffNextLegDuration,
		insertion.scheduledDropoffTimeStart,
		insertion.scheduledDropoffTimeEnd,
		dropoffEventGroup,
		false
	);
	return scheduledTimes;
}
