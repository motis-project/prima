import type { Company } from '$lib/compositionTypes';
import type { Range } from './capacitySimulation';
import type { InsertionInfo } from './insertionTypes';

type VehicleId = number;

export function iterateAllInsertions(
	companies: Company[],
	insertions: Map<VehicleId, Range[]>,
	insertionFn: (info: InsertionInfo, insertionCounter: number, busStopFilter: boolean[]) => void
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
					const info = {
						insertionIdx: idxInEvents,
						companyIdx,
						vehicle,
						prevEventIdxInRoutingResults,
						nextEventIdxInRoutingResults,
						currentRange: insertion
					};
					insertionFn(info, insertionIdx, company.busStopFilter);
					if (idxInEvents != 0 || vehicle.lastEventBefore != undefined) {
						prevEventIdxInRoutingResults++;
					}
					if (idxInEvents != vehicle.events.length || vehicle.firstEventAfter != undefined) {
						nextEventIdxInRoutingResults++;
					}
					insertionIdx++;
				}
			});
		});
	});
}
