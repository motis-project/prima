import { InsertHow } from '$lib/util/booking/insertionTypes';
import type { Insertion } from './insertion';
import type { Event } from '$lib/server/booking/getBookingAvailability';
import { groupBy } from '$lib/util/groupBy';

export function getFirstAndLastEvents(mergeTourList: Event[], best: Insertion, events: Event[]) {
	if (best.pickupCase.how === InsertHow.NEW_TOUR) {
		return {
			departure: -1,
			arrival: -1,
			firstEvents: [],
			lastEvents: []
		};
	}
	let departure = Number.MAX_SAFE_INTEGER;
	let arrival = -1;
	if (mergeTourList.length !== 0) {
		for (const tour of mergeTourList) {
			if (departure > tour.departure) {
				departure = tour.departure;
			}
			if (arrival < tour.arrival) {
				arrival = tour.arrival;
			}
			if (best.pickupCase.how !== InsertHow.PREPEND) {
				best.departure = departure;
			}
			if (best.dropoffCase.how !== InsertHow.APPEND) {
				best.arrival = arrival;
			}
		}
	}
	const filteredEvents = groupBy(
		events.filter((e) => mergeTourList.some((t) => t.tourId === e.tourId)),
		(e) => e.tourId,
		(e) => e
	);
	const firstEvents: Event[] = [];
	const lastEvents: Event[] = [];
	for (const [_, tour] of filteredEvents) {
		tour.sort((e1, e2) =>
			e1.scheduledTimeStart === e2.scheduledTimeStart
				? e1.scheduledTimeEnd - e2.scheduledTimeEnd
				: e1.scheduledTimeStart - e2.scheduledTimeStart
		);
		const firstEvent = tour[0];
		const lastEvent = tour[tour.length - 1];
		if (
			firstEvent.departure !== departure &&
			firstEvent.id !== best.nextPickupId &&
			firstEvent.id !== best.nextDropoffId
		) {
			firstEvents.push(firstEvent);
		}
		if (
			lastEvent.arrival !== arrival &&
			lastEvent.id !== best.prevPickupId &&
			lastEvent.id !== best.prevDropoffId
		) {
			lastEvents.push(lastEvent);
		}
	}
	return {
		firstEvents: firstEvents.sort((e) => e.scheduledTimeStart),
		lastEvents: lastEvents.sort((e) => e.scheduledTimeEnd),
		departure,
		arrival
	};
}
