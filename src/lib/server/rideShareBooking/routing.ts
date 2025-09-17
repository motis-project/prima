import type { Coordinates } from '$lib/util/Coordinates';
import { batchOneToManyCarRouting } from '$lib/server/util/batchOneToManyCarRouting';
import type { Range } from '$lib/util/booking/getPossibleInsertions';
import { PASSENGER_CHANGE_DURATION } from '$lib/constants';
import { isSamePlace } from '../booking/isSamePlace';
import type { BusStop } from '../booking/BusStop';
import type { VehicleId } from '../booking/VehicleId';
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

	const forward: ((Coordinates & { eventId: number }) | undefined)[] = [];

	const backward: ((Coordinates & { eventId: number }) | undefined)[] = [];
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

	const fromBusStop = await Promise.all(
		busStops.map((b) => batchOneToManyCarRouting(b, forward, false))
	);
	const toBusStop = await Promise.all(
		busStops.map((b) => batchOneToManyCarRouting(b, backward, true))
	);
	return {
		userChosen: {
			fromUserChosen,
			toUserChosen
		},
		busStops: {
			fromBusStop: fromBusStop.map((b, busStopIdx) =>
				setZeroDistanceForMatchingPlaces(busStops[busStopIdx], forward, b)
			),
			toBusStop: toBusStop.map((b, busStopIdx) =>
				setZeroDistanceForMatchingPlaces(busStops[busStopIdx], backward, b)
			)
		}
	};
}
