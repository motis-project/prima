import type { Company, Vehicle } from '$lib/compositionTypes';
import type { Range } from './capacitySimulation';

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
		busStopIdx: number|undefined,
		companyIdx: number,
		prevEventPos: number,
		nextEventPos: number,
		vehicle: Vehicle,
		outerInsertionIdx: number,
		innerInsertionIdx: number | undefined
	) => void
) {
	const iterateInsertions=(companyFilter: boolean[]|undefined, busStopIdx: number|undefined)=>{
		companies.forEach((company, companyIdx) => {
			if(companyFilter!=undefined && !companyFilter[companyIdx]){
				return;
			}
			company.vehicles.forEach((vehicle) => {
				insertions.get(vehicle.id)!.forEach((insertion) => {
					for (
						let outerIdx = insertion.earliestPickup;
						outerIdx != insertion.latestDropoff + 1;
						++outerIdx
					) {
						if (type == ITERATE_INSERTIONS_MODE.SINGLE) {
							insertionFn(
								busStopIdx,
								companyIdx,
								prevEventPos,
								nextEventPos,
								vehicle,
								outerIdx,
								undefined
							);
						} else {
							for (let innerIdx = outerIdx + 1; innerIdx != insertion.latestDropoff + 1; ++innerIdx) {
								insertionFn(
									busStopIdx,
									companyIdx,
									prevEventPos,
									nextEventPos,
									vehicle,
									outerIdx,
									innerIdx
								);
							}
						}
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
	}
	let prevEventPos = companies.length;
	let nextEventPos = companies.length;
	iterateInsertions(undefined, undefined);
	busStopCompanyFilter.forEach((companyFilter, busStopIdx) =>{
		const companyCount = companyFilter.filter((f) => f).length;
		prevEventPos=companyCount;
		nextEventPos=companyCount;
		iterateInsertions(companyFilter, busStopIdx);
	});
}
