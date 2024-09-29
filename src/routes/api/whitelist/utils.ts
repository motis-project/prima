import type { Company } from '$lib/compositionTypes';
import type { Range } from './capacitySimulation';
import type { InsertionInfo } from './insertionTypes';

export enum ITERATE_INSERTIONS_MODE {
	SINGLE,
	PAIRS
}

export function iterateAllInsertions(
	type: ITERATE_INSERTIONS_MODE,
	companies: Company[],
	busStopCompanyFilter: boolean[][],
	insertions: Map<number, Range[]>,
	insertionFn: (
		busStopIdx: number | undefined,
		info: InsertionInfo,
		insertionCounter: number,
		innerInsertionIdx: number | undefined
	) => void
) {
	const iterateInsertions = (
		companyFilter: boolean[] | undefined,
		busStopIdx: number | undefined
	) => {
		let prevEventIdxInRoutingResults = 0;
		let nextEventIdxInRoutingResults = 0;
		let companyIdxInRoutingResults = 0;
		let insertionCounter = 0;
		companies.forEach((company, companyIdx) => {
			if (companyFilter != undefined && !companyFilter[companyIdx]) {
				return;
			}
			company.vehicles.forEach((vehicle) => {
				insertions.get(vehicle.id)!.forEach((insertion) => {
					for (
						let outerIdx = insertion.earliestPickup;
						outerIdx != insertion.latestDropoff + 1;
						++outerIdx
					) {
						const info = {
							insertionIdx: outerIdx,
							companyIdx,
							vehicle,
							prevEventIdxInRoutingResults,
							nextEventIdxInRoutingResults,
							companyIdxInRoutingResults
						};
						if (type == ITERATE_INSERTIONS_MODE.SINGLE) {
							insertionFn(busStopIdx, info, insertionCounter, undefined);
						} else {
							for (
								let innerIdx = outerIdx + 1;
								innerIdx != insertion.latestDropoff + 1;
								++innerIdx
							) {
								insertionFn(busStopIdx, info, insertionCounter, innerIdx);
							}
						}
						if (outerIdx != 0) {
							prevEventIdxInRoutingResults++;
						}
						if (outerIdx != vehicle.events.length) {
							nextEventIdxInRoutingResults++;
						}
						insertionCounter++;
					}
				});
			});
			companyIdxInRoutingResults++;
		});
	};
	// iterate for user chosen coordinates
	iterateInsertions(undefined, undefined);
	busStopCompanyFilter.forEach((companyFilter, busStopIdx) => {
		// iterate for each bus stop
		iterateInsertions(companyFilter, busStopIdx);
	});
}
