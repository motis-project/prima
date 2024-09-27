import { Direction, oneToMany, type OneToManyResult } from '$lib/api';
import type { BusStop } from '$lib/busStop';
import type { Company } from '$lib/compositionTypes';
import { Coordinates } from '$lib/location';
import type { Range } from './capacitySimulation';
import { iterateAllInsertions, ITERATE_INSERTIONS_MODE } from './utils';

export type InsertionRoutingResult = {
	fromCompany: OneToManyResult[];
	toCompany: OneToManyResult[];
	fromPrevEvent: OneToManyResult[];
	toNextEvent: OneToManyResult[];
};

export type RoutingResults = {
	busStops: InsertionRoutingResult[];
	userChosen: InsertionRoutingResult;
};

type RoutingCoordinates = {
	busStopForwardMany: Coordinates[][];
	busStopBackwardMany: Coordinates[][];
	userChosenForwardMany: Coordinates[];
	userChosenBackwardMany: Coordinates[];
};

export function gatherRoutingCoordinates(
	companies: Company[],
	busStops: BusStop[],
	insertionsByVehicle: Map<number, Range[]>,
	busStopCompanyFilter: boolean[][]
): RoutingCoordinates {
	const userChosenForwardMany = new Array<Coordinates>();
	const userChosenBackwardMany = new Array<Coordinates>();
	const busStopForwardMany = new Array<Coordinates[]>(busStops.length);
	const busStopBackwardMany = new Array<Coordinates[]>(busStops.length);
	for (let busStopIdx = 0; busStopIdx != busStops.length; ++busStopIdx) {
		busStopForwardMany[busStopIdx] = new Array<Coordinates>();
		busStopBackwardMany[busStopIdx] = new Array<Coordinates>();
	}
	companies.forEach((company, companyIdx) => {
		for (let busStopIdx = 0; busStopIdx != busStops.length; ++busStopIdx) {
			if (!busStopCompanyFilter[busStopIdx][companyIdx]) {
				continue;
			}
			busStopForwardMany[busStopIdx].push(company.coordinates);
			busStopBackwardMany[busStopIdx].push(company.coordinates);
		}
		userChosenForwardMany.push(company.coordinates);
		userChosenBackwardMany.push(company.coordinates);
	});
	iterateAllInsertions(
		ITERATE_INSERTIONS_MODE.SINGLE,
		companies,
		busStopCompanyFilter,
		insertionsByVehicle,
		(busStopIdx, insertionInfo) => {
			const backwardMany =
				busStopIdx == undefined ? userChosenBackwardMany : busStopBackwardMany[busStopIdx];
			const forwardMany =
				busStopIdx == undefined ? userChosenForwardMany : busStopForwardMany[busStopIdx];
			if (insertionInfo.insertionIdx != 0) {
				backwardMany.push(insertionInfo.vehicle.events[insertionInfo.insertionIdx - 1].coordinates);
			}
			if (insertionInfo.insertionIdx != insertionInfo.vehicle.events.length) {
				forwardMany.push(insertionInfo.vehicle.events[insertionInfo.insertionIdx].coordinates);
			}
		}
	);
	return {
		busStopForwardMany,
		busStopBackwardMany,
		userChosenForwardMany,
		userChosenBackwardMany
	};
}

export async function routing(
	coordinates: RoutingCoordinates,
	userChosen: Coordinates,
	busStops: BusStop[],
	busStopCompanyFilter: boolean[][]
): Promise<RoutingResults> {
	console.assert(busStopCompanyFilter.length != 0);
	const from = await oneToMany(userChosen, coordinates.userChosenBackwardMany, Direction.Backward);
	const to = await oneToMany(userChosen, coordinates.userChosenForwardMany, Direction.Forward);
	const ret = {
		userChosen: {
			fromCompany: from.slice(0, busStopCompanyFilter.length),
			fromPrevEvent: from.slice(busStopCompanyFilter.length),
			toCompany: to.slice(0, busStopCompanyFilter.length),
			toNextEvent: to.slice(busStopCompanyFilter.length)
		},
		busStops: new Array<InsertionRoutingResult>(busStops.length)
	};
	for (let busStopIdx = 0; busStopIdx != busStops.length; ++busStopIdx) {
		const busStop = busStops[busStopIdx];
		const relevantCompanyCount = busStopCompanyFilter[busStopIdx].filter((f) => f).length;
		const from = await oneToMany(
			busStop.coordinates,
			coordinates.busStopBackwardMany[busStopIdx],
			Direction.Backward
		);
		const to = await oneToMany(
			busStop.coordinates,
			coordinates.busStopForwardMany[busStopIdx],
			Direction.Forward
		);
		ret.busStops[busStopIdx] = {
			fromCompany: from.slice(0, relevantCompanyCount),
			fromPrevEvent: from.slice(relevantCompanyCount),
			toCompany: to.slice(0, relevantCompanyCount),
			toNextEvent: to.slice(relevantCompanyCount)
		};
	}
	return ret;
}
