import { InsertWhat } from '$lib/util/booking/insertionTypes';
import { Interval } from '$lib/util/interval';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';
import { InsertDirection, type InsertionType } from '../booking/insertionTypes';
import type { RideShareEvent } from './getRideShareTours';
import type { InsertionInfo } from './insertionTypes';
import type { RoutingResults } from './routing';

export const getPrevLegDuration = (
	insertionCase: InsertionType,
	routingResults: RoutingResults,
	insertionInfo: InsertionInfo,
	busStopIdx: number | undefined
): number | undefined => {
	let relevantRoutingResults: (number | undefined)[] | undefined = undefined;
	switch (insertionCase.what) {
		case InsertWhat.USER_CHOSEN:
			relevantRoutingResults = routingResults.userChosen.toUserChosen;
			break;

		case InsertWhat.BOTH:
			console.assert(busStopIdx != undefined);
			relevantRoutingResults =
				insertionCase.direction == InsertDirection.BUS_STOP_PICKUP
					? routingResults.busStops.toBusStop[busStopIdx!]
					: routingResults.userChosen.toUserChosen;
			break;

		case InsertWhat.BUS_STOP:
			relevantRoutingResults = routingResults.busStops.toBusStop[busStopIdx!];
			break;
	}
	return relevantRoutingResults[insertionInfo.insertionIdx];
};

export const getNextLegDuration = (
	insertionCase: InsertionType,
	routingResults: RoutingResults,
	insertionInfo: InsertionInfo,
	busStopIdx: number | undefined
): number | undefined => {
	let relevantRoutingResults: (number | undefined)[] | undefined = undefined;
	switch (insertionCase.what) {
		case InsertWhat.USER_CHOSEN:
			relevantRoutingResults = routingResults.userChosen.fromUserChosen;
			break;

		case InsertWhat.BOTH:
			relevantRoutingResults =
				insertionCase.direction == InsertDirection.BUS_STOP_PICKUP
					? routingResults.userChosen.fromUserChosen
					: routingResults.busStops.fromBusStop[busStopIdx!];
			break;

		case InsertWhat.BUS_STOP:
			console.assert(busStopIdx != undefined);
			relevantRoutingResults = routingResults.busStops.fromBusStop[busStopIdx!];
			break;
	}
	return relevantRoutingResults[insertionInfo.insertionIdx];
};

export function getAllowedOperationTimes(
	prev: RideShareEvent,
	next: RideShareEvent,
	prepTime: UnixtimeMs
): Interval[] {
	const windowEndTime = next.scheduledTimeEnd;
	if (windowEndTime < prepTime) {
		return [];
	}
	console.log('klarajj', prev);
	let windowStartTime = prev.scheduledTimeStart;
	windowStartTime = Math.max(windowStartTime, prepTime);
	return [new Interval(windowStartTime, windowEndTime)];
}

export function getArrivalWindow(
	insertionCase: InsertionType,
	windows: Interval[],
	directDuration: number,
	busStopWindow: Interval | undefined,
	prevLegDuration: number,
	nextLegDuration: number,
	allowedTimes: Interval[]
): Interval | undefined {
	const directWindows = Interval.intersect(
		allowedTimes,
		windows
			.map((window) => window.shrink(prevLegDuration, nextLegDuration))
			.filter((window) => window != undefined)
	);

	let arrivalWindows = directWindows
		.map((window) =>
			window.shrink(
				insertionCase.direction == InsertDirection.BUS_STOP_DROPOFF ? directDuration : 0,
				insertionCase.direction == InsertDirection.BUS_STOP_PICKUP ? directDuration : 0
			)
		)
		.filter((window) => window != undefined);
	if (busStopWindow != undefined) {
		arrivalWindows = arrivalWindows
			.map((window) => busStopWindow.intersect(window))
			.filter((window) => window != undefined);
	}
	if (arrivalWindows.length == 0) {
		return undefined;
	}
	const best =
		insertionCase.direction == InsertDirection.BUS_STOP_PICKUP
			? arrivalWindows.reduce((current, best) => (current.endTime < best.endTime ? current : best))
			: arrivalWindows.reduce((current, best) => (current.endTime > best.endTime ? current : best));
	return best;
}
