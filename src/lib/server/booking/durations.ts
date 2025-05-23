import { BUFFER_TIME, MAX_TRAVEL, PASSENGER_CHANGE_DURATION } from '$lib/constants';
import { implication } from '$lib/server/util/implication';
import { Interval } from '$lib/util/interval';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';
import type { DbEvent, VehicleWithInterval } from './getBookingAvailability';
import {
	InsertDirection,
	InsertHow,
	InsertWhat,
	printInsertionType,
	type InsertionInfo,
	type InsertionType
} from './insertionTypes';
import type { InsertionRoutingResult, RoutingResults } from './routing';

export const returnsToCompany = (insertionCase: InsertionType): boolean =>
	insertionCase.how == InsertHow.APPEND || insertionCase.how == InsertHow.NEW_TOUR;

export const comesFromCompany = (insertionCase: InsertionType): boolean =>
	insertionCase.how == InsertHow.PREPEND || insertionCase.how == InsertHow.NEW_TOUR;

export const getPrevLegDuration = (
	insertionCase: InsertionType,
	routingResults: RoutingResults,
	insertionInfo: InsertionInfo,
	busStopIdx: number | undefined
): number | undefined => {
	let relevantRoutingResults: InsertionRoutingResult | undefined = undefined;
	switch (insertionCase.what) {
		case InsertWhat.USER_CHOSEN:
			relevantRoutingResults = routingResults.userChosen;
			break;

		case InsertWhat.BOTH:
			console.assert(busStopIdx != undefined);
			relevantRoutingResults =
				insertionCase.direction == InsertDirection.BUS_STOP_PICKUP
					? routingResults.busStops[busStopIdx!]
					: routingResults.userChosen;
			break;

		case InsertWhat.BUS_STOP:
			console.assert(busStopIdx != undefined);
			relevantRoutingResults = routingResults.busStops[busStopIdx!];
			break;
	}

	const drivingTime = comesFromCompany(insertionCase)
		? relevantRoutingResults.company[insertionInfo.companyIdx]
		: relevantRoutingResults.event[insertionInfo.prevEventIdxInRoutingResults];
	if (drivingTime == undefined || drivingTime > MAX_TRAVEL) {
		return undefined;
	}
	return drivingTime + BUFFER_TIME;
};

export const getNextLegDuration = (
	insertionCase: InsertionType,
	routingResults: RoutingResults,
	insertionInfo: InsertionInfo,
	busStopIdx: number | undefined
): number | undefined => {
	let relevantRoutingResults: InsertionRoutingResult | undefined = undefined;
	switch (insertionCase.what) {
		case InsertWhat.USER_CHOSEN:
			relevantRoutingResults = routingResults.userChosen;
			break;

		case InsertWhat.BOTH:
			console.assert(busStopIdx != undefined);
			relevantRoutingResults =
				insertionCase.direction == InsertDirection.BUS_STOP_PICKUP
					? routingResults.userChosen
					: routingResults.busStops[busStopIdx!];
			break;

		case InsertWhat.BUS_STOP:
			console.assert(busStopIdx != undefined);
			relevantRoutingResults = routingResults.busStops[busStopIdx!];
			break;
	}

	const drivingTime = returnsToCompany(insertionCase)
		? relevantRoutingResults.company[insertionInfo.companyIdx]
		: relevantRoutingResults.event[insertionInfo.nextEventIdxInRoutingResults];
	if (drivingTime == undefined || drivingTime > MAX_TRAVEL) {
		console.log('driving time undefined', drivingTime);
		return undefined;
	}
	return drivingTime + PASSENGER_CHANGE_DURATION + BUFFER_TIME;
};

export function getAllowedOperationTimes(
	insertionCase: InsertionType,
	prev: DbEvent | undefined,
	next: DbEvent | undefined,
	expandedSearchInterval: Interval,
	prepTime: UnixtimeMs,
	vehicle: VehicleWithInterval
): Interval[] {
	console.assert(
		implication(!returnsToCompany(insertionCase), next !== undefined),
		`getAllowedOperationTimes: no return to company but next not defined (${printInsertionType(insertionCase)})`
	);
	console.assert(
		implication(!comesFromCompany(insertionCase), prev !== undefined),
		`getAllowedOperationTimes: no come from company but prev not defined (${printInsertionType(insertionCase)})`
	);
	console.assert(
		implication(
			insertionCase.how === InsertHow.INSERT,
			prev !== undefined &&
				next !== undefined &&
				!returnsToCompany(insertionCase) &&
				!comesFromCompany(insertionCase)
		),
		`getAllowedOperationTimes: insertion case requires prev and next event (${printInsertionType(insertionCase)})`
	);

	const windowEndTime =
		next == undefined
			? expandedSearchInterval.endTime
			: returnsToCompany(insertionCase)
				? next.departure
				: next.scheduledTimeEnd;
	if (windowEndTime < prepTime) {
		return [];
	}

	let windowStartTime =
		prev == undefined
			? expandedSearchInterval.startTime
			: comesFromCompany(insertionCase)
				? prev.arrival
				: prev.scheduledTimeStart;
	windowStartTime = Math.max(windowStartTime, prepTime);
	const window = new Interval(windowStartTime, windowEndTime);
	if (insertionCase.how == InsertHow.INSERT) {
		return [window];
	}
	const relevantAvailabilities = (() => {
		switch (insertionCase.how) {
			case InsertHow.APPEND:
				return vehicle.availabilities.filter((a) => new Interval(a).covers(windowStartTime));
			case InsertHow.PREPEND:
				return vehicle.availabilities.filter((a) => new Interval(a).covers(windowEndTime));
			case InsertHow.CONNECT:
				return vehicle.availabilities.filter((a) => new Interval(a).contains(window));
			case InsertHow.NEW_TOUR:
				return Interval.subtract(
					vehicle.availabilities.map((x) => new Interval(x)),
					vehicle.tours.map((tour) => new Interval(tour.departure, tour.arrival))
				);
		}
	})();
	console.assert(
		!(insertionCase.how != InsertHow.NEW_TOUR && relevantAvailabilities.length > 1),
		`Found ${relevantAvailabilities.length} intervals, which are supposed to be disjoint, containing the same timestamp.`
	);
	return relevantAvailabilities
		.map((availability) => new Interval(availability).intersect(window))
		.filter((availability) => availability != undefined);
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
	// TODO why?
	return insertionCase.direction == InsertDirection.BUS_STOP_PICKUP
		? arrivalWindows.reduce((current, best) => (current.endTime < best.endTime ? current : best))
		: arrivalWindows.reduce((current, best) => (current.endTime > best.endTime ? current : best));
}
