import type { Company, Vehicle } from '$lib/compositionTypes';
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
		innerInsertionIdx: number | undefined
	) => void
) {
	const iterateInsertions = (
		companyFilter: boolean[] | undefined,
		busStopIdx: number | undefined,
		prevEventIdx: number,
		nextEventIdx: number
	) => {
		companies.forEach((company, companyIdx) => {
			if (companyFilter != undefined && !companyFilter[companyIdx]) {
				return;
			}
			company.vehicles.forEach((vehicle, vid) => {
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
							prevEventIdx,
							nextEventIdx
						};
						if (type == ITERATE_INSERTIONS_MODE.SINGLE) {
							insertionFn(busStopIdx, info, undefined);
						} else {
							for (
								let innerIdx = outerIdx + 1;
								innerIdx != insertion.latestDropoff + 1;
								++innerIdx
							) {
								insertionFn(busStopIdx, info, innerIdx);
							}
						}
						if (outerIdx != 0) {
							prevEventIdx++;
						}
						if (outerIdx != vehicle.events.length) {
							nextEventIdx++;
						}
					}
				});
			});
		});
	};
	let prevEventPos = companies.length;
	let nextEventPos = companies.length;
	iterateInsertions(undefined, undefined, prevEventPos, nextEventPos);
	busStopCompanyFilter.forEach((companyFilter, busStopIdx) => {
		const companyCount = companyFilter.filter((f) => f).length;
		prevEventPos = companyCount;
		nextEventPos = companyCount;
		iterateInsertions(companyFilter, busStopIdx, prevEventPos, nextEventPos);
	});
}
