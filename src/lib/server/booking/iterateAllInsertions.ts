import type { Company } from './getBookingAvailability';
import type { InsertionInfo } from './insertionTypes';
import type { VehicleId } from './VehicleId';
import type { Range } from '$lib/util/booking/getPossibleInsertions';

export function iterateAllInsertions(
	companies: Company[],
	insertions: Map<VehicleId, Range[]>,
	insertionFn: (info: InsertionInfo, insertionCounter: number) => void
) {
	let prevEventIdxInRoutingResults = 0;
	let nextEventIdxInRoutingResults = 0;
	let insertionIdx = 0;
	companies.forEach((company, companyIdx) => {
		company.vehicles.forEach((vehicle) => {
			insertions.get(vehicle.id)!.forEach((insertion) => {
				for (
					let idxInEvents = insertion.earliestPickup;
					idxInEvents != insertion.latestDropoff + 1;
					++idxInEvents
				) {
					insertionFn(
						{
							idxInEvents,
							companyIdx,
							vehicle,
							prevEventIdxInRoutingResults,
							nextEventIdxInRoutingResults,
							currentRange: insertion
						},
						insertionIdx
					);

					const prepend = idxInEvents == 0;
					if (!(prepend && vehicle.lastEventBefore == undefined)) {
						prevEventIdxInRoutingResults++;
					}

					const append = idxInEvents != vehicle.events.length;
					if (!(append && vehicle.firstEventAfter == undefined)) {
						nextEventIdxInRoutingResults++;
					}

					insertionIdx++;
				}
			});
		});
	});
}
