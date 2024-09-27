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
		prevEventPos: number,
		nextEventPos: number
	) => {
		companies.forEach((company, companyIdx) => {
			if (companyFilter != undefined && !companyFilter[companyIdx]) {
				return;
			}
			console.log('company', companyIdx);
			company.vehicles.forEach((vehicle, vid) => {
				console.log('vehicle', vid);
				insertions.get(vehicle.id)!.forEach((insertion) => {
					for (
						let outerIdx = insertion.earliestPickup;
						outerIdx != insertion.latestDropoff;
						++outerIdx
					) {
						//console.log('insertion', outerIdx);
						//console.log('nnext', nextEventPos);
						const info = 
						{
							insertionIdx: outerIdx,
							companyIdx,
							vehicle,
							prevEventIdx: outerIdx == 0 ? undefined : prevEventPos,
							nextEventIdx: outerIdx == vehicle.events.length ? undefined : nextEventPos
						};
						if (type == ITERATE_INSERTIONS_MODE.SINGLE) {
							insertionFn(
								busStopIdx,
								info,
								undefined
							);
						} else {
							for (
								let innerIdx = outerIdx + 1;
								innerIdx != insertion.latestDropoff + 1;
								++innerIdx
							) {
								insertionFn(
									busStopIdx,
									info,
									innerIdx
								);
							}
						}
						console.log('outer', outerIdx);
						if (outerIdx != 0) {
							prevEventPos++;
						}
						if (outerIdx != vehicle.events.length) {
							nextEventPos++;
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
		console.log('busstop', busStopIdx);
		console.assert(companyFilter.length == companies.length);
		const companyCount = companyFilter.filter((f) => f).length;
		prevEventPos = companyCount;
		nextEventPos = companyCount;
		iterateInsertions(companyFilter, busStopIdx, prevEventPos, nextEventPos);
	});
}
