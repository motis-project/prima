import type { Event } from '../getBookingAvailability';

const compareEvents = (left: Event, right: Event) =>
	left.scheduledTimeStart - right.scheduledTimeStart ||
	left.scheduledTimeEnd - right.scheduledTimeEnd;

export function getFirstEventOfTours(events: Event[], tourIds: ReadonlySet<number>) {
	return events
		.filter((event) => tourIds.has(event.tourId))
		.reduce<
			Event | undefined
		>((first, event) => (first === undefined || compareEvents(event, first) < 0 ? event : first), undefined);
}

export function getLastEventOfTours(events: Event[], tourIds: ReadonlySet<number>) {
	return events
		.filter((event) => tourIds.has(event.tourId))
		.reduce<
			Event | undefined
		>((last, event) => (last === undefined || compareEvents(event, last) > 0 ? event : last), undefined);
}

export function getLastEventOfLatestTourEndingBefore(
	events: Event[],
	time: number,
	excludedTourIds: ReadonlySet<number> = new Set()
) {
	const previousTour = events.reduce<Event | undefined>(
		(latest, event) =>
			!excludedTourIds.has(event.tourId) &&
			event.arrival <= time &&
			(latest === undefined || event.arrival > latest.arrival)
				? event
				: latest,
		undefined
	);
	return previousTour === undefined
		? undefined
		: getLastEventOfTours(events, new Set([previousTour.tourId]));
}

export function getFirstEventOfEarliestTourStartingAfter(
	events: Event[],
	time: number,
	excludedTourIds: ReadonlySet<number> = new Set()
) {
	const nextTour = events.reduce<Event | undefined>(
		(earliest, event) =>
			!excludedTourIds.has(event.tourId) &&
			event.departure >= time &&
			(earliest === undefined || event.departure < earliest.departure)
				? event
				: earliest,
		undefined
	);
	return nextTour === undefined
		? undefined
		: getFirstEventOfTours(events, new Set([nextTour.tourId]));
}
