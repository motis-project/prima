import type { Company } from './getBookingAvailability';
import type { InsertionInfo } from './insertionTypes';
import type { VehicleId } from './VehicleId';
import type { Range } from '$lib/util/booking/getPossibleInsertions';

export async function iterateAllInsertions(
	companies: Company[],
	insertions: Map<VehicleId, Range[]>,
	insertionFn: (info: InsertionInfo) => void
) {
	let insertionIdx = 0;
	companies.forEach((company, companyIdx) => {
		company.vehicles.forEach((vehicle) => {
			insertions.get(vehicle.id)!.forEach((insertion) => {
				for (
					let idxInEvents = insertion.earliestPickup;
					idxInEvents != insertion.latestDropoff + 1;
					++idxInEvents
				) {
					insertionFn({
						idxInVehicleEvents: idxInEvents,
						companyIdx,
						vehicle,
						currentRange: insertion,
						insertionIdx
					});
					insertionIdx++;
				}
			});
		});
	});
}
