import { Direction, oneToMany, type OneToManyResult } from '$lib/api';
import type { BusStop } from '$lib/busStop';
import type { Company } from '$lib/compositionTypes';
import { Coordinates } from '$lib/location';
import type { Range } from './capacitySimulation';
import { iterateAllInsertions } from './utils';

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
	if (busStopCompanyFilter.length == 0) {
		return {
			busStopBackwardMany: [],
			busStopForwardMany: [],
			userChosenBackwardMany: [],
			userChosenForwardMany: []
		};
	}
	const userChosenForwardMany = new Array<Coordinates>();
	const userChosenBackwardMany = new Array<Coordinates>();
	const busStopForwardMany = new Array<Coordinates[]>(busStopCompanyFilter[0].length);
	const busStopBackwardMany = new Array<Coordinates[]>(busStopCompanyFilter[0].length);
	for (let busStopIdx = 0; busStopIdx != busStopCompanyFilter[0].length; ++busStopIdx) {
		busStopForwardMany[busStopIdx] = new Array<Coordinates>();
		busStopBackwardMany[busStopIdx] = new Array<Coordinates>();
	}
	companies.forEach((company, companyIdx) => {
		for (let busStopIdx = 0; busStopIdx != busStopCompanyFilter[0].length; ++busStopIdx) {
			if (!busStopCompanyFilter[companyIdx][busStopIdx]) {
				continue;
			}
			busStopForwardMany[busStopIdx].push(company.coordinates);
			busStopBackwardMany[busStopIdx].push(company.coordinates);
		}
		userChosenForwardMany.push(company.coordinates);
		userChosenBackwardMany.push(company.coordinates);
	});
	iterateAllInsertions(
		companies,
		busStopCompanyFilter,
		insertionsByVehicle,
		(insertionInfo, _insertionCounter, busStopFilter) => {
			if (insertionInfo.insertionIdx != 0) {
				userChosenBackwardMany.push(
					insertionInfo.vehicle.events[insertionInfo.insertionIdx - 1].coordinates
				);
			}
			if (insertionInfo.insertionIdx != insertionInfo.vehicle.events.length) {
				userChosenForwardMany.push(
					insertionInfo.vehicle.events[insertionInfo.insertionIdx].coordinates
				);
			}
			for (let busStopIdx = 0; busStopIdx != busStopFilter.length; ++busStopIdx) {
				if (!busStopFilter[busStopIdx]) {
					continue;
				}
				if (insertionInfo.insertionIdx != 0) {
					busStopBackwardMany[busStopIdx].push(
						insertionInfo.vehicle.events[insertionInfo.insertionIdx - 1].coordinates
					);
				}
				if (insertionInfo.insertionIdx != insertionInfo.vehicle.events.length) {
					busStopForwardMany[busStopIdx].push(
						insertionInfo.vehicle.events[insertionInfo.insertionIdx].coordinates
					);
				}
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
