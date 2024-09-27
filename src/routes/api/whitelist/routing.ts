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
	insertionsByVehicle: Map<number, Range[]>,
	busStopCompanyFilter: boolean[][]
): RoutingCoordinates {
	const userChosenForwardMany = new Array<Coordinates>();
	const userChosenBackwardMany = new Array<Coordinates>();
	const busStopForwardMany = new Array<Coordinates[]>(busStopCompanyFilter.length);
	const busStopBackwardMany = new Array<Coordinates[]>(busStopCompanyFilter.length);
	for (let busStopIdx = 0; busStopIdx != busStopCompanyFilter.length; ++busStopIdx) {
		busStopForwardMany[busStopIdx] = new Array<Coordinates>();
		busStopBackwardMany[busStopIdx] = new Array<Coordinates>();
	}
	companies.forEach((company, companyIdx) => {
		for (let busStopIdx = 0; busStopIdx != busStopCompanyFilter.length; ++busStopIdx) {
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
		(busStopIdx, InsertionInfo, _) => {
			const backwardMany =
				busStopIdx == undefined ? userChosenBackwardMany : busStopBackwardMany[busStopIdx];
			const forwardMany =
				busStopIdx == undefined ? userChosenForwardMany : busStopForwardMany[busStopIdx];
			if (InsertionInfo.insertionIdx != 0) {
				backwardMany.push(InsertionInfo.vehicle.events[InsertionInfo.insertionIdx - 1].coordinates);
			}
			if (InsertionInfo.insertionIdx != InsertionInfo.vehicle.events.length) {
				forwardMany.push(InsertionInfo.vehicle.events[InsertionInfo.insertionIdx].coordinates);
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
	const from = await oneToMany(userChosen, coordinates.userChosenBackwardMany, Direction.Backward);
	const to = await oneToMany(userChosen, coordinates.userChosenForwardMany, Direction.Forward);
	const ret = {
		userChosen: {
			fromCompany: from.slice(0, busStops.length),
			fromPrevEvent: from.slice(busStops.length),
			toCompany: to.slice(0, busStops.length),
			toNextEvent: to.slice(busStops.length)
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
