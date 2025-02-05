import type { Coordinates } from '$lib/util/Coordinates';
import type { BusStop } from './BusStop';
import type { Company } from './getBookingAvailability';
import type { InsertionInfo } from './insertionTypes';
import { iterateAllInsertions } from './iterateAllInsertions';
import type { VehicleId } from './VehicleId';
import type { Range } from './getPossibleInsertions';
import { isSamePlace } from './isSamePlace';
import { batchOneToManyCarRouting } from '$lib/server/util/batchOneToManyCarRouting';

export type InsertionRoutingResult = {
	company: (number | undefined)[];
	event: (number | undefined)[];
};

export type RoutingResults = {
	busStops: InsertionRoutingResult[];
	userChosen: InsertionRoutingResult;
};

export function gatherRoutingCoordinates(
	companies: Company[],
	insertionsByVehicle: Map<VehicleId, Range[]>
) {
	const backward: Coordinates[] = [...companies];
	const forward: Coordinates[] = [...companies];
	iterateAllInsertions(companies, insertionsByVehicle, (insertionInfo: InsertionInfo) => {
		const vehicle = insertionInfo.vehicle;
		const idxInEvents = insertionInfo.idxInEvents;
		if (idxInEvents != 0) {
			backward.push(vehicle.events[idxInEvents - 1]);
		} else if (vehicle.lastEventBefore != undefined) {
			backward.push(vehicle.lastEventBefore);
		}
		if (idxInEvents != vehicle.events.length) {
			forward.push(vehicle.events[idxInEvents]);
		} else if (vehicle.firstEventAfter != undefined) {
			forward.push(vehicle.firstEventAfter);
		}
	});
	return { forward, backward };
}

export async function routing(
	companies: Company[],
	many: { forward: Coordinates[]; backward: Coordinates[] },
	userChosen: Coordinates,
	busStops: BusStop[],
	startFixed: boolean
): Promise<RoutingResults> {
	const setZeroDistanceForMatchingPlaces = (
		coordinates: Coordinates,
		many: Coordinates[],
		routingResult: (number | undefined)[]
	) => {
		console.assert(many.length == routingResult.length);
		for (let i = 0; i != many.length; ++i) {
			if (isSamePlace(coordinates, many[i])) {
				routingResult[i] = 0;
			}
		}
	};

	const userChosenMany = startFixed ? many.backward : many.forward;
	const userChosenResult = await batchOneToManyCarRouting(userChosen, userChosenMany, !startFixed);
	setZeroDistanceForMatchingPlaces(userChosen, userChosenMany, userChosenResult);

	const busStopMany = !startFixed ? many.backward : many.forward;
	const busStopResults = await Promise.all(
		busStops.map((b) => batchOneToManyCarRouting(b, busStopMany, startFixed))
	);

	return {
		userChosen: {
			company: userChosenResult.slice(0, companies.length),
			event: userChosenResult.slice(companies.length)
		},
		busStops: busStopResults.map((b, busStopIdx) => {
			setZeroDistanceForMatchingPlaces(busStops[busStopIdx], busStopMany, b);
			return {
				company: b.slice(0, companies.length),
				event: b.slice(companies.length)
			};
		})
	};
}
