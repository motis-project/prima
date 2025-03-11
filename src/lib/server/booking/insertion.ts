import {
	MIN_PREP,
	PASSENGER_TIME_COST_FACTOR,
	TAXI_DRIVING_TIME_COST_FACTOR,
	TAXI_WAITING_TIME_COST_FACTOR
} from '$lib/constants';
import {
	InsertDirection,
	InsertHow,
	InsertWhat,
	InsertWhere,
	type InsertionInfo,
	type InsertionType,
	printInsertionType
} from './insertionTypes';
import {
	comesFromCompany,
	getAllowedOperationTimes,
	getPrevLegDuration,
	getArrivalWindow,
	getNextLegDuration,
	returnsToCompany
} from './durations';
//import type { PromisedTimes } from './PromisedTimes';
import type { Interval } from '$lib/server/util/interval';
import type { RoutingResults } from './routing';
import type { Company, Event } from './getBookingAvailability';
import type { Capacities } from './Capacities';
import { isValid } from './getPossibleInsertions';
import { getScheduledEventTime } from '$lib/util/getScheduledEventTime';
import { nowOrSimulationTime } from '$lib/time';

export type InsertionEvaluation = {
	pickupTime: number;
	dropoffTime: number;
	pickupCase: InsertionType;
	dropoffCase: InsertionType;
	taxiWaitingTime: number;
	taxiDuration: number;
	passengerDuration: number;
	cost: number;
	departure: number | undefined;
	arrival: number | undefined;
	pickupPrevLegDuration: number;
	pickupNextLegDuration: number;
	dropoffPrevLegDuration: number;
	dropoffNextLegDuration: number;
};

export type Insertion = InsertionEvaluation & {
	pickupIdx: number | undefined;
	dropoffIdx: number | undefined;
	company: number;
	vehicle: number;
	tour: number | undefined;
};

export type NeighbourIds = {
	prevPickup: number | undefined;
	nextPickup: number | undefined;
	prevDropoff: number | undefined;
	nextDropoff: number | undefined;
};

export function toInsertionWithISOStrings(i: Insertion | undefined) {
	return i === undefined
		? undefined
		: {
				...i,
				pickupTime: new Date(i.pickupTime).toISOString(),
				dropoffTime: new Date(i.dropoffTime).toISOString(),
				departure: i.departure == undefined ? undefined : new Date(i.departure).toISOString(),
				arrival: i.arrival == undefined ? undefined : new Date(i.arrival).toISOString()
			};
}

export function printInsertionEvaluation(e: Insertion) {
	return (
		'pickupTime: ' +
		new Date(e.pickupTime).toISOString() +
		'\n' +
		'dropoffTime: ' +
		new Date(e.dropoffTime).toISOString() +
		'\n' +
		'pickupCase: ' +
		printInsertionType(e.pickupCase) +
		'\n' +
		'dropoffCase: ' +
		printInsertionType(e.dropoffCase) +
		'\n' +
		'taxiWaitingTime: ' +
		e.taxiWaitingTime +
		'\n' +
		'taxiDuration: ' +
		e.taxiDuration +
		'\n' +
		'passengerDuration: ' +
		e.passengerDuration +
		'\n' +
		'cost: ' +
		e.cost +
		'\n' +
		'company: ' +
		e.company +
		'\n' +
		'vehicle: ' +
		e.vehicle +
		'\n' +
		'tour: ' +
		e.tour +
		'\n' +
		'departure: ' +
		(e.departure ? new Date(e.departure).toISOString() : undefined) +
		'\n' +
		'arrival: ' +
		(e.arrival ? new Date(e.arrival).toISOString() : undefined) +
		'\n' +
		'pickupprevLegDuration: ' +
		e.pickupPrevLegDuration +
		'\n' +
		'pickupnextLegDuration: ' +
		e.pickupNextLegDuration +
		'\n' +
		'dropoffprevLegDuration: ' +
		e.dropoffPrevLegDuration +
		'\n' +
		'dropoffnextLegDuration: ' +
		e.dropoffNextLegDuration +
		'\n'
	);
}

export function evaluateBothInsertion(
	insertionCase: InsertionType,
	windows: Interval[],
	passengerDuration: number | undefined,
	busStopWindow: Interval | undefined,
	routingResults: RoutingResults,
	insertionInfo: InsertionInfo,
	busStopIdx: number | undefined,
	prev: Event | undefined,
	next: Event | undefined,
	allowedTimes: Interval[]
	//promisedTimes?: PromisedTimes
): InsertionEvaluation | undefined {
	console.assert(
		insertionCase.what == InsertWhat.BOTH,
		'Not inserting both in evaluateBothInsertion.'
	);
	const prevLegDuration = getPrevLegDuration(
		insertionCase,
		routingResults,
		insertionInfo,
		busStopIdx
	);
	const nextLegDuration = getNextLegDuration(
		insertionCase,
		routingResults,
		insertionInfo,
		busStopIdx
	);
	if (
		prevLegDuration == undefined ||
		nextLegDuration == undefined ||
		passengerDuration == undefined
	) {
		return undefined;
	}
	const arrivalWindow = getArrivalWindow(
		insertionCase,
		windows,
		passengerDuration,
		busStopWindow,
		prevLegDuration,
		nextLegDuration,
		allowedTimes
	);
	if (arrivalWindow == undefined) {
		return undefined;
	}
	/*
	if (
		promisedTimes != undefined &&
		!keepsPromises(insertionCase, arrivalWindow, passengerDuration, promisedTimes)
	) {
		return undefined;
	}
	*/
	const taxiDuration =
		prevLegDuration +
		nextLegDuration +
		passengerDuration -
		getOldDrivingTime(insertionCase, prev, next);

	const pickupTime =
		insertionCase.direction == InsertDirection.BUS_STOP_PICKUP
			? arrivalWindow.startTime
			: arrivalWindow.endTime - passengerDuration;
	const dropoffTime =
		insertionCase.direction == InsertDirection.BUS_STOP_PICKUP
			? arrivalWindow.startTime + passengerDuration
			: arrivalWindow.endTime;
	const departure = comesFromCompany(insertionCase) ? pickupTime - prevLegDuration : undefined;
	const arrival = returnsToCompany(insertionCase) ? dropoffTime + nextLegDuration : undefined;
	const taxiWaitingTime = getTaxiWaitingDelta(
		prevLegDuration + nextLegDuration + passengerDuration,
		insertionCase,
		departure,
		arrival,
		prev,
		next
	);
	return {
		pickupTime,
		dropoffTime,
		pickupCase: structuredClone(insertionCase),
		dropoffCase: structuredClone(insertionCase),
		passengerDuration,
		taxiDuration,
		taxiWaitingTime,
		cost: computeCost(passengerDuration, taxiDuration, taxiWaitingTime),
		departure,
		arrival,
		pickupPrevLegDuration: prevLegDuration,
		pickupNextLegDuration: passengerDuration,
		dropoffPrevLegDuration: passengerDuration,
		dropoffNextLegDuration: nextLegDuration
	};
}

export function evaluateNewTours(
	companies: Company[],
	required: Capacities,
	startFixed: boolean,
	expandedSearchInterval: Interval,
	busStopTimes: Interval[][],
	routingResults: RoutingResults,
	travelDurations: (number | undefined)[],
	allowedTimes: Interval[]
	//promisedTimes?: PromisedTimes
): (Insertion | undefined)[][] {
	const bestEvaluations = new Array<(Insertion | undefined)[]>(busStopTimes.length);
	for (let i = 0; i != busStopTimes.length; ++i) {
		bestEvaluations[i] = new Array<Insertion | undefined>(busStopTimes[i].length);
	}

	const insertionCase = {
		how: InsertHow.NEW_TOUR,
		what: InsertWhat.BOTH,
		where: InsertWhere.BEFORE_FIRST_EVENT,
		direction: startFixed ? InsertDirection.BUS_STOP_PICKUP : InsertDirection.BUS_STOP_DROPOFF
	};
	const prepTime = nowOrSimulationTime().getTime() + MIN_PREP;

	companies.forEach((company, companyIdx) => {
		company.vehicles.forEach((vehicle) => {
			const insertionInfo: InsertionInfo = {
				companyIdx,
				prevEventIdxInRoutingResults: 1,
				nextEventIdxInRoutingResults: 1,
				vehicle,
				idxInEvents: 1,
				currentRange: { earliestPickup: 0, latestDropoff: 0 }
			};
			console.assert(isValid(vehicle, required), 'vehicle does not have capacity');
			const windows = getAllowedOperationTimes(
				insertionCase,
				undefined,
				undefined,
				expandedSearchInterval,
				prepTime,
				vehicle
			);
			for (let busStopIdx = 0; busStopIdx != busStopTimes.length; ++busStopIdx) {
				for (let busTimeIdx = 0; busTimeIdx != busStopTimes[busStopIdx].length; ++busTimeIdx) {
					const resultNewTour = evaluateBothInsertion(
						insertionCase,
						windows,
						travelDurations[busStopIdx],
						busStopTimes[busStopIdx][busTimeIdx],
						routingResults,
						insertionInfo,
						busStopIdx,
						undefined,
						undefined,
						allowedTimes
						//promisedTimes
					);
					if (
						resultNewTour != undefined &&
						(bestEvaluations[busStopIdx][busTimeIdx] == undefined ||
							resultNewTour.cost < bestEvaluations[busStopIdx][busTimeIdx]!.cost)
					) {
						bestEvaluations[busStopIdx][busTimeIdx] = {
							...resultNewTour,
							company: companyIdx,
							vehicle: vehicle.id,
							tour: undefined,
							pickupIdx: undefined,
							dropoffIdx: undefined
						};
					}
				}
			}
		});
	});
	return bestEvaluations;
}

const computeCost = (passengerDuration: number, taxiDuration: number, taxiWaitingTime: number) => {
	return (
		TAXI_DRIVING_TIME_COST_FACTOR * taxiDuration +
		PASSENGER_TIME_COST_FACTOR * passengerDuration +
		TAXI_WAITING_TIME_COST_FACTOR * taxiWaitingTime
	);
};

function getTaxiWaitingDelta(
	drivingDuration: number,
	insertionCase: InsertionType,
	departure: number | undefined,
	arrival: number | undefined,
	prev: Event | undefined,
	next: Event | undefined
): number {
	if (insertionCase.how == InsertHow.NEW_TOUR) {
		return 0;
	}
	const oldWaitingTime =
		insertionCase.how == InsertHow.INSERT
			? getScheduledEventTime(next!) - getScheduledEventTime(prev!) - prev!.nextLegDuration
			: 0;
	const prevTaskTime =
		insertionCase.how == InsertHow.PREPEND ? departure! : getScheduledEventTime(prev!);
	const nextTaskTime =
		insertionCase.how == InsertHow.APPEND ? arrival! : getScheduledEventTime(next!);
	const newWaitingTime = nextTaskTime - prevTaskTime - drivingDuration;
	console.assert(newWaitingTime >= 0, 'Waiting time is negative.');
	return newWaitingTime - oldWaitingTime;
}

const getOldDrivingTime = (
	insertionCase: InsertionType,
	prev: Event | undefined,
	next: Event | undefined
): number => {
	if (insertionCase.how == InsertHow.NEW_TOUR) {
		return 0;
	}
	if (insertionCase.how == InsertHow.CONNECT) {
		return next!.prevLegDuration + prev!.nextLegDuration;
	}
	console.assert(prev != undefined || next != undefined, 'getOldDrivingTime: no event found');
	if (prev == undefined) {
		console.assert(
			insertionCase.how == InsertHow.PREPEND,
			'getOldDrivingTime: no previous but also no prepend'
		);
		return next!.prevLegDuration;
	}
	return prev.nextLegDuration;
};
/*
const keepsPromises = (
	insertionCase: InsertionType,
	arrivalWindow: Interval,
	directDuration: number,
	promisedTimes: PromisedTimes
): boolean => {
	const w = arrivalWindow.shift(
		insertionCase.direction == InsertDirection.BUS_STOP_PICKUP ? directDuration : -directDuration
	);
	const pickupWindow = (
		insertionCase.direction == InsertDirection.BUS_STOP_PICKUP ? arrivalWindow : w
	).round();
	const dropoffWindow = (
		insertionCase.direction == InsertDirection.BUS_STOP_DROPOFF ? arrivalWindow : w
	).round();

	let checkPickup = false;
	let checkDropoff = false;
	switch (insertionCase.what) {
		case InsertWhat.BOTH:
			checkPickup = true;
			checkDropoff = true;
			break;

		case InsertWhat.BUS_STOP:
			if (insertionCase.direction == InsertDirection.BUS_STOP_PICKUP) {
				checkPickup = true;
			} else {
				checkDropoff = true;
			}
			break;

		case InsertWhat.USER_CHOSEN:
			if (insertionCase.direction != InsertDirection.BUS_STOP_PICKUP) {
				checkPickup = true;
			} else {
				checkDropoff = true;
			}
	}
	console.log('KEEPS PROMISE', { checkPickup, checkDropoff });
	if (checkPickup && !pickupWindow.covers(promisedTimes.pickup)) {
		console.log('PROMISE CHECK: PICKUP WINDOW FAILED', {
			pickupWindow: pickupWindow.toString(),
			pickup: new Date(promisedTimes.pickup).toISOString()
		});
		return false;
	}
	if (checkDropoff && !dropoffWindow.covers(promisedTimes.dropoff)) {
		console.log('PROMISE CHECK: DROPOFF WINDOW FAILED', {
			dropoffWindow: dropoffWindow.toString(),
			dropoff: new Date(promisedTimes.dropoff).toISOString()
		});
		return false;
	}
	return true;
};
*/
