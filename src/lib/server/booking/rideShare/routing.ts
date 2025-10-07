import type { Coordinates } from '$lib/util/Coordinates';
import { batchOneToManyCarRouting } from '$lib/server/util/batchOneToManyCarRouting';
import type { Range } from '$lib/util/booking/getPossibleInsertions';
import { PASSENGER_CHANGE_DURATION } from '$lib/constants';
import { isSamePlace } from '../isSamePlace';
import type { BusStop } from '../taxi/BusStop';
import type { VehicleId } from '../taxi/VehicleId';
import { iterateAllInsertions } from './iterateAllInsertions';
import type { RideShareTour } from './getRideShareTours';

export type RoutingResults = {
	busStops: { fromBusStop: (number | undefined)[][]; toBusStop: (number | undefined)[][] };
	userChosen: { fromUserChosen: (number | undefined)[]; toUserChosen: (number | undefined)[] };
};

export async function routing(
	rideShareTours: RideShareTour[],
	userChosen: Coordinates,
	busStops: BusStop[],
	insertionRanges: Map<VehicleId, Range[]>
): Promise<RoutingResults> {
	const setZeroDistanceForMatchingPlaces = (
		coordinatesOne: Coordinates,
		coordinatesMany: (Coordinates | undefined)[],
		routingResult: (number | undefined)[]
	) => {
		const result = new Array<number | undefined>(routingResult.length);
		for (let i = 0; i != coordinatesMany.length; ++i) {
			if (coordinatesMany[i] === undefined) {
				continue;
			}
			if (isSamePlace(coordinatesOne, coordinatesMany[i]!)) {
				result[i] = 0;
			}
			result[i] =
				routingResult[i] !== undefined ? routingResult[i]! + PASSENGER_CHANGE_DURATION : undefined;
		}
		return result;
	};

	const forward: (Coordinates | undefined)[] = [];
	const backward: (Coordinates | undefined)[] = [];
	iterateAllInsertions(rideShareTours, insertionRanges, (info) => {
		forward.push(
			info.idxInEvents === info.events.length ? undefined : info.events[info.idxInEvents]
		);
		backward.push(info.idxInEvents === 0 ? undefined : info.events[info.idxInEvents - 1]);
	});
	let fromUserChosen = await batchOneToManyCarRouting(userChosen, forward, false);
	let toUserChosen = await batchOneToManyCarRouting(userChosen, backward, true);
	fromUserChosen = setZeroDistanceForMatchingPlaces(userChosen, forward, fromUserChosen);
	toUserChosen = setZeroDistanceForMatchingPlaces(userChosen, backward, toUserChosen);

	const forwardSmallerBusStops = forward.length < busStops.length;
	const forwardSmallerArray: (Coordinates | undefined)[] = forwardSmallerBusStops
		? forward
		: busStops;
	const forwardLargerArray: (Coordinates | undefined)[] = !forwardSmallerBusStops
		? forward
		: busStops;
	const fromBusStop: (number | undefined)[][] = await Promise.all(
		forwardSmallerArray.map((b) =>
			b === undefined
				? new Array<undefined>(busStops.length)
				: batchOneToManyCarRouting(b, forwardLargerArray, false)
		)
	);
	const backwardSmallerBusStops = backward.length < busStops.length;
	const backwardSmallerArray: (Coordinates | undefined)[] = backwardSmallerBusStops
		? backward
		: busStops;
	const backwardLargerArray: (Coordinates | undefined)[] = !backwardSmallerBusStops
		? backward
		: busStops;
	const toBusStop: (number | undefined)[][] = await Promise.all(
		backwardSmallerArray.map((b) =>
			b === undefined
				? new Array<undefined>(busStops.length)
				: batchOneToManyCarRouting(b, backwardLargerArray, true)
		)
	);
	return {
		userChosen: {
			fromUserChosen,
			toUserChosen
		},
		busStops: {
			fromBusStop: (forwardSmallerBusStops ? transpose(fromBusStop) : fromBusStop).map(
				(b, busStopIdx) =>
					setZeroDistanceForMatchingPlaces(busStops[busStopIdx], forwardSmallerArray, b)
			),
			toBusStop: (backwardSmallerBusStops ? transpose(toBusStop) : toBusStop).map((b, busStopIdx) =>
				setZeroDistanceForMatchingPlaces(busStops[busStopIdx], backwardSmallerArray, b)
			)
		}
	};
}

function transpose<T>(arr: (T | undefined)[][]): (T | undefined)[][] {
	const maxLen = Math.max(0, ...arr.map((r) => r.length));
	return Array.from({ length: maxLen }, (_, idx) => arr.map((row) => row[idx]));
}
