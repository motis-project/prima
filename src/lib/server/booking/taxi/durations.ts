import { implication } from '$lib/server/util/implication';
import { InsertHow, InsertWhat } from '$lib/util/booking/insertionTypes';
import { Interval } from '$lib/util/interval';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';
import type { Event, VehicleWithInterval } from './getBookingAvailability';
import {
	InsertDirection,
	printInsertionType,
	type InsertionInfo,
	type InsertionType
} from '../insertionTypes';
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
			console.assert(
				busStopIdx != undefined,
				'Found unexpected undefined busstop in getLegDuration function.'
			);
			relevantRoutingResults = routingResults.busStops.toBusStop[busStopIdx!];
			break;
	}
	return comesFromCompany(insertionCase)
		? relevantRoutingResults.company[insertionInfo.companyIdx]
		: relevantRoutingResults.event[insertionInfo.insertionIdx];
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
			relevantRoutingResults = routingResults.userChosen.fromUserChosen;
			break;

		case InsertWhat.BOTH:
			console.assert(
				busStopIdx != undefined,
				'Found unexpected undefined busstop in getLegDuration function.'
			);
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
	return returnsToCompany(insertionCase)
		? relevantRoutingResults.company[insertionInfo.companyIdx]
		: relevantRoutingResults.event[insertionInfo.insertionIdx];
};
export function getAllowedOperationTimes(
	insertionCase: InsertionType,
	prev: Event | undefined,
	next: Event | undefined,
	expandedSearchInterval: Interval,
	prepTime: UnixtimeMs,
	vehicle: VehicleWithInterval,
	allowedTimes: Interval[]
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
	const finalWindow = Interval.intersect(
		relevantAvailabilities
			.map((availability) => new Interval(availability).intersect(window))
			.filter((availability) => availability != undefined),
		allowedTimes
	).filter((availability) => availability != undefined);
	return finalWindow;
}

export function getArrivalWindow(
	insertionCase: InsertionType,
	windows: Interval[],
	directDuration: number,
	busStopWindow: Interval | undefined,
	prevLegDuration: number,
	nextLegDuration: number
): Interval | undefined {
	const directWindows = windows
		.map((window) => window.shrink(prevLegDuration, nextLegDuration))
		.filter((window) => window != undefined);

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
