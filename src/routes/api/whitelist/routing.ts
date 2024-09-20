import { Direction, oneToMany, type oneToManyResult } from '$lib/api';
import type { BusStop } from '$lib/busStop';
import type { Company, Vehicle, Event } from '$lib/compositionTypes';
import { Coordinates } from '$lib/location';
import type { Range } from './capacitySimulation';

type RoutingCoordinates = {
	busStopMany: Coordinates[][];
	userChosenMany: Coordinates[];
};

type InsertionRoutingResult = {
	fromPrev: oneToManyResult[];
	toNext: oneToManyResult[];
};

type RoutingResults = {
	busStops: InsertionRoutingResult[];
	userChosen: InsertionRoutingResult;
};

function iterateAllInsertions(
	companies: Company[],
	insertions: Map<number, Range[]>,
	vehicleFn: (v: Vehicle) => void,
	insertionFn: (events: Event[], insertionIdx: number, companyPos: number, eventPos: number) => void
) {
	let companyPos = 0;
	let eventPos = companies.length;
	companies.forEach((company) => {
		company.vehicles.forEach((vehicle) => {
			vehicleFn(vehicle);
			const events = vehicle.tours.flatMap((t) => t.events);
			insertions.get(vehicle.id)!.forEach((insertion) => {
				for (
					let insertionIdx = insertion.earliestPickup;
					insertionIdx != insertion.latestDropoff;
					++insertionIdx
				) {
					insertionFn(events, insertionIdx, companyPos, eventPos++);
				}
			});
		});
		companyPos++;
	});
}

export function gatherRoutingCoordinates(
	companies: Company[],
	busStops: BusStop[],
	insertionsByVehicle: Map<number, Range[]>
): RoutingCoordinates {
	const eventInsertionCount = companies
		.flatMap((c) => c.vehicles)
		.flatMap((v) => insertionsByVehicle.get(v.id)!)
		.reduce((sum, current) => sum + current.latestDropoff - current.earliestPickup, 0);
	const insertionCount = companies.length + eventInsertionCount;
	const busStopMany = new Array<Coordinates[]>(busStops.length);
	for (let i = 0; i != busStopMany.length; ++i) {
		busStopMany[i] = new Array<Coordinates>(insertionCount);
	}
	const userChosenMany = new Array<Coordinates>(insertionCount);
	companies.forEach((company, companyPos) => {
		for (let busStopIdx = 0; busStopIdx != busStops.length; ++busStopIdx) {
			busStopMany[busStopIdx][companyPos] = company.coordinates;
		}
		userChosenMany[companyPos] = company.coordinates;
	});
	iterateAllInsertions(
		companies,
		insertionsByVehicle,
		(_) => {},
		(events, insertionIdx, _, eventPos) => {
			const eventCoordinates = events[insertionIdx].coordinates;
			for (let busStopIdx = 0; busStopIdx != busStops.length; ++busStopIdx) {
				busStopMany[busStopIdx][eventPos] = eventCoordinates;
			}
			userChosenMany[eventPos] = eventCoordinates;
		}
	);
	console.log(userChosenMany);
	return {
		busStopMany,
		userChosenMany
	};
}

export async function routing(
	coordinates: RoutingCoordinates,
	userChosen: Coordinates,
	busStops: BusStop[]
): Promise<RoutingResults> {
	const ret = {
		userChosen: {
			fromPrev: await oneToMany(userChosen, coordinates.userChosenMany, Direction.Backward),
			toNext: await oneToMany(userChosen, coordinates.userChosenMany, Direction.Forward)
		},
		busStops: new Array<InsertionRoutingResult>(busStops.length)
	};
	for (let busStopIdx = 0; busStopIdx != busStops.length; ++busStopIdx) {
		const busStop = busStops[busStopIdx];
		const busStopMany = coordinates.busStopMany[busStopIdx];
		ret.busStops[busStopIdx] = {
			fromPrev: await oneToMany(busStop.coordinates, busStopMany, Direction.Backward),
			toNext: await oneToMany(busStop.coordinates, busStopMany, Direction.Forward)
		};
	}
	return ret;
};
