import { PASSENGER_CHANGE_DURATION } from '$lib/constants';
import { Interval } from '$lib/util/interval';
import type { Event } from '$lib/server/booking/getBookingAvailability';

export type ScheduledTimes = {
	updates: {
		event_id: number;
		time: number;
		start: boolean;
	}[];
};

export function getScheduledTimes(
	pickupTimeStart: number,
	pickupTimeEnd: number,
	dropoffTimeStart: number,
	dropoffTimeEnd: number,
	prevPickupEvent: undefined | (Event & { time: Interval }),
	nextPickupEvent: undefined | (Event & { time: Interval }),
	nextDropoffEvent: undefined | (Event & { time: Interval }),
	prevDropoffEvent: undefined | (Event & { time: Interval }),
	pickupPrevLegDuration: number,
	pickupNextLegDuration: number,
	dropoffPrevLegDuration: number,
	dropoffNextLegDuration: number,
	firstEvents: Event[],
	lastEvents: Event[]
) {
	const scheduledTimes: ScheduledTimes = {
		updates: []
	};
	if (prevPickupEvent) {
		const prevPickupLeeway =
			pickupTimeStart - prevPickupEvent.scheduledTimeStart - pickupPrevLegDuration;
		if (prevPickupLeeway < 0) {
			console.log('Error in getScheduledTimes 1');
			throw new Error();
		}
		if (prevPickupLeeway < prevPickupEvent.time.size()) {
			scheduledTimes.updates.push({
				event_id: prevPickupEvent.id,
				start: false,
				time: prevPickupEvent.scheduledTimeStart + prevPickupLeeway
			});
		}
	}
	if (nextPickupEvent) {
		const nextPickupLeeway =
			nextPickupEvent.scheduledTimeEnd - pickupTimeEnd - pickupNextLegDuration;
		if (nextPickupLeeway < 0) {
			console.log('Error in getScheduledTimes 2');
			throw new Error();
		}
		if (nextPickupLeeway < nextPickupEvent.time.size()) {
			scheduledTimes.updates.push({
				event_id: nextPickupEvent.id,
				start: true,
				time: nextPickupEvent.scheduledTimeEnd - nextPickupLeeway
			});
		}
	}
	if (nextDropoffEvent) {
		const nextDropoffLeeway =
			nextDropoffEvent.scheduledTimeEnd - dropoffTimeEnd - dropoffNextLegDuration;
		if (nextDropoffLeeway < 0) {
			console.log('Error in getScheduledTimes 3');
			throw new Error();
		}
		if (nextDropoffLeeway < nextDropoffEvent.time.size()) {
			scheduledTimes.updates.push({
				event_id: nextDropoffEvent.id,
				start: true,
				time: nextDropoffEvent.scheduledTimeEnd - nextDropoffLeeway
			});
		}
	}
	if (prevDropoffEvent) {
		const prevDropoffLeeway =
			dropoffTimeStart - prevDropoffEvent.scheduledTimeStart - dropoffPrevLegDuration;
		if (prevDropoffLeeway < 0) {
			console.log('Error in getScheduledTimes 4');
			throw new Error();
		}
		if (prevDropoffLeeway < prevDropoffEvent.time.size()) {
			scheduledTimes.updates.push({
				event_id: prevDropoffEvent.id,
				start: false,
				time: prevDropoffEvent.scheduledTimeStart + prevDropoffLeeway
			});
		}
	}
	for (let i = 0; i != firstEvents.length; ++i) {
		const earlierEvent = lastEvents[i];
		const laterEvent = firstEvents[i];
		const distance =
			laterEvent.tourId === earlierEvent.tourId
				? laterEvent.prevLegDuration
				: laterEvent.directDuration;
		const start1 =
			scheduledTimes.updates.find((upd) => upd.event_id === earlierEvent.id)?.time ??
			earlierEvent.scheduledTimeStart;
		const end1 = earlierEvent.scheduledTimeEnd;
		const start2 = laterEvent.scheduledTimeStart;
		if (distance === null || distance + PASSENGER_CHANGE_DURATION < start2 - end1) {
			return scheduledTimes;
		}
		const gap = distance - start2 + end1;
		if (end1 - start1 < gap) {
			scheduledTimes.updates.push({
				event_id: earlierEvent.id,
				start: false,
				time: start1
			});
			scheduledTimes.updates.push({
				event_id: laterEvent.id,
				start: true,
				time: start2 + gap - end1 + start1
			});
		} else {
			scheduledTimes.updates.push({
				event_id: earlierEvent.id,
				start: false,
				time: end1 - gap
			});
		}
	}
	return scheduledTimes;
}
