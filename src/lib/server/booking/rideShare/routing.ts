import type { Coordinates } from '$lib/util/Coordinates';
import { batchOneToManyCarRouting } from '$lib/server/util/batchOneToManyCarRouting';
import type { Range } from '$lib/util/booking/getPossibleInsertions';
import { PASSENGER_CHANGE_DURATION } from '$lib/constants';
import { isSamePlace } from '$lib/util/booking/isSamePlace';
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
	insertionRanges: Map<VehicleId, Range[]>,
	maxTourTime: number
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
			} else {
				result[i] =
					routingResult[i] !== undefined
						? routingResult[i]! + PASSENGER_CHANGE_DURATION
						: undefined;
			}
		}
		return result;
	};

	const forward: ((Coordinates & { eventId: number }) | undefined)[] = [];
	const backward: ((Coordinates & { eventId: number }) | undefined)[] = [];
	iterateAllInsertions(rideShareTours, insertionRanges, (info) => {
		forward.push(
			info.idxInEvents === info.events.length ? undefined : info.events[info.idxInEvents]
		);
		backward.push(info.idxInEvents === 0 ? undefined : info.events[info.idxInEvents - 1]);
	});
	let fromUserChosen = await batchOneToManyCarRouting(userChosen, forward, false, maxTourTime);
	let toUserChosen = await batchOneToManyCarRouting(userChosen, backward, true, maxTourTime);
	fromUserChosen = setZeroDistanceForMatchingPlaces(userChosen, forward, fromUserChosen);
	toUserChosen = setZeroDistanceForMatchingPlaces(userChosen, backward, toUserChosen);

	const fromBusStop: Promise<(number | undefined)[][]> = Promise.all(
		forward.map((b) =>
			b === undefined
				? new Array<undefined>(busStops.length)
				: batchOneToManyCarRouting(b, busStops, true, maxTourTime)
		)
	);
	const toBusStop: Promise<(number | undefined)[][]> = Promise.all(
		backward.map((b) =>
			b === undefined
				? new Array<undefined>(busStops.length)
				: batchOneToManyCarRouting(b, busStops, false, maxTourTime)
		)
	);
	return {
		userChosen: {
			fromUserChosen,
			toUserChosen
		},
		busStops: {
			fromBusStop: transpose(await fromBusStop).map((b, busStopIdx) =>
				setZeroDistanceForMatchingPlaces(busStops[busStopIdx], forward, b)
			),
			toBusStop: transpose(await toBusStop).map((b, busStopIdx) =>
				setZeroDistanceForMatchingPlaces(busStops[busStopIdx], backward, b)
			)
		}
	};
}

function transpose<T>(arr: (T | undefined)[][]): (T | undefined)[][] {
	const maxLen = Math.max(0, ...arr.map((r) => r.length));
	return Array.from({ length: maxLen }, (_, idx) => arr.map((row) => row[idx]));
}
