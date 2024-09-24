import { Direction, oneToMany, type OneToManyResult } from '$lib/api';
import type { BusStop } from '$lib/busStop';
import type { Company } from '$lib/compositionTypes';
import { Coordinates } from '$lib/location';
import type { Range } from './capacitySimulation';
import { iterateAllInsertions, ITERATE_INSERTIONS_MODE } from './utils';

export type InsertionRoutingResult = {
	fromPrev: OneToManyResult[];
	toNext: OneToManyResult[];
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
		(busStopIdx, companyIdx, prevEventPos_, nextEventPos_, vehicle, insertionIdx) => {
			const backwardMany =
				busStopIdx == undefined ? userChosenBackwardMany : busStopBackwardMany[busStopIdx];
			const forwardMany =
				busStopIdx == undefined ? userChosenForwardMany : busStopForwardMany[busStopIdx];
			if (insertionIdx != 0) {
				backwardMany.push(vehicle.events[insertionIdx - 1].coordinates);
			}
			if (insertionIdx != vehicle.events.length) {
				forwardMany.push(vehicle.events[insertionIdx].coordinates);
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
	busStops: BusStop[]
): Promise<RoutingResults> {
	const ret = {
		userChosen: {
			fromPrev: await oneToMany(userChosen, coordinates.userChosenBackwardMany, Direction.Backward),
			toNext: await oneToMany(userChosen, coordinates.userChosenForwardMany, Direction.Forward)
		},
		busStops: new Array<InsertionRoutingResult>(busStops.length)
	};
	for (let busStopIdx = 0; busStopIdx != busStops.length; ++busStopIdx) {
		const busStop = busStops[busStopIdx];
		ret.busStops[busStopIdx] = {
			fromPrev: await oneToMany(
				busStop.coordinates,
				coordinates.busStopBackwardMany[busStopIdx],
				Direction.Backward
			),
			toNext: await oneToMany(
				busStop.coordinates,
				coordinates.busStopForwardMany[busStopIdx],
				Direction.Forward
			)
		};
	}
	return ret;
}
