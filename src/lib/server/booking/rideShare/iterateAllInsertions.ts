import type { InsertionInfo } from './insertionTypes';
import type { Range } from '$lib/util/booking/getPossibleInsertions';
import type { RideShareTour } from './getRideShareTours';

export async function iterateAllInsertions(
	rideShareTours: RideShareTour[],
	insertions: Map<number, Range[]>,
	insertionFn: (info: InsertionInfo) => void
) {
	let insertionIdx = 0;
	rideShareTours.forEach((tour, tourIdx) => {
		insertions.get(tour.rideShareTour)!.forEach((insertion) => {
			for (
				let idxInEvents = insertion.earliestPickup;
				idxInEvents != insertion.latestDropoff + 1;
				++idxInEvents
			) {
				insertionFn({
					idxInEvents: idxInEvents,
					rideShareTourIdx: tourIdx,
					currentRange: insertion,
					insertionIdx,
					events: tour.events.filter((e) => !e.pending),
					provider: tour.owner
				});
				insertionIdx++;
			}
		});
	});
}
