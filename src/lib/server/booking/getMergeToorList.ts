import type { Event } from '$lib/server/booking/getBookingAvailability';
import { InsertHow } from './insertionTypes';

export const getMergeTourList = (
	events: Event[],
	pickupHow: InsertHow,
	dropoffHow: InsertHow,
	pickupIdx: number | undefined,
	dropoffIdx: number | undefined
): Set<number> => {
	if (events.length == 0) {
		return new Set<number>();
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
	if (tours.size == 1) {
		return new Set<number>();
	}
	return tours;
};
