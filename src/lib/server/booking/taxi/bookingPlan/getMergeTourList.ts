import type { Event } from '$lib/server/booking/taxi/getBookingAvailability';
import { InsertHow } from '$lib/util/booking/insertionTypes';

export const getMergeTourList = (
	events: Event[],
	pickupHow: InsertHow,
	dropoffHow: InsertHow,
	pickupIdx: number | undefined,
	dropoffIdx: number | undefined
): Event[] => {
	if (events.length == 0 || pickupHow === InsertHow.NEW_TOUR) {
		return [];
	}
	const tours = new Set<number>();
	if (pickupHow == InsertHow.CONNECT) {
		tours.add(events[pickupIdx! - 1].tourId);
	}
	if (dropoffHow == InsertHow.CONNECT) {
		tours.add(events[dropoffIdx!].tourId); // TODO testcase
	}
	events.slice(pickupIdx ?? 0, dropoffIdx ?? events.length - 1).forEach((ev) => {
		tours.add(ev.tourId);
	});
	return [...tours].map((t) => events.find((e) => t === e.tourId)).filter((e) => e !== undefined);
};
