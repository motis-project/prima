import type { InsertionInfo } from './insertionTypes';
import type { Range } from '$lib/util/booking/getPossibleInsertions';
import type { RideShareTour } from './getRideShareTours';
import { groupBy } from '$lib/util/groupBy';

export async function iterateAllInsertions(
	rideShareTours: RideShareTour[],
	insertions: Map<number, Range[]>,
	insertionFn: (info: InsertionInfo) => void
) {
	let insertionIdx = 0;
	const toursByVehicle = groupBy(
		rideShareTours,
		(t) => t.vehicle,
		(t) => t
	);
	toursByVehicle.forEach((vehicleTours) => {
		vehicleTours.forEach((tour, tourIdx) => {
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
						provider: tour.owner,
						vehicle: tour.vehicle
					});
					insertionIdx++;
				}
			});
		});
	});
}
