import {
	MIN_PREP,
	PASSENGER_CHANGE_DURATION,
	PASSENGER_TIME_COST_FACTOR,
	TAXI_DRIVING_TIME_COST_FACTOR,
	TAXI_WAITING_TIME_COST_FACTOR
} from '$lib/constants';
import {
	INSERT_HOW_OPTIONS,
	InsertDirection,
	InsertHow,
	InsertWhat,
	InsertWhere,
	type InsertionInfo,
	type InsertionType,
	canCaseBeValid,
	isCaseValid,
	isEarlierBetter,
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
import type { PromisedTimes } from './PromisedTimes';
import { Interval } from '$lib/util/interval';
import type { RoutingResults } from './routing';
import type { Company, Event } from './getBookingAvailability';
import type { Capacities } from '$lib/util/booking/Capacities';
import { isValid } from '$lib/util/booking/getPossibleInsertions';
import { getScheduledEventTime } from '$lib/util/getScheduledEventTime';
import { roundToUnit, MINUTE } from '$lib/util/time';
import { iterateAllInsertions } from './iterateAllInsertions';
import { type Range } from '$lib/util/booking/getPossibleInsertions';

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

type SingleInsertionEvaluation = {
	time: number;
	window: Interval;
	approachDuration: number;
	returnDuration: number;
	case: InsertionType;
	taxiWaitingTime: number;
	taxiDuration: number;
	passengerDuration: number;
	cost: number;
};

type Evaluations = {
	busStopEvaluations: (SingleInsertionEvaluation | undefined)[][][];
	userChosenEvaluations: (SingleInsertionEvaluation | undefined)[];
	bothEvaluations: (Insertion | undefined)[][];
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

export function evaluateSingleInsertion(
	insertionCase: InsertionType,
	windows: Interval[],
	busStopWindow: Interval | undefined,
	routingResults: RoutingResults,
	insertionInfo: InsertionInfo,
	busStopIdx: number | undefined,
	prev: Event | undefined,
	next: Event | undefined,
	allowedTimes: Interval[],
	promisedTimes?: PromisedTimes
): SingleInsertionEvaluation | undefined {
	console.assert(insertionCase.what != InsertWhat.BOTH);
	const approachDuration = getPrevLegDuration(
		insertionCase,
		routingResults,
		insertionInfo,
		busStopIdx
	);
	const returnDuration = getNextLegDuration(
		insertionCase,
		routingResults,
		insertionInfo,
		busStopIdx
	);
	if (approachDuration == undefined || returnDuration == undefined) {
		return undefined;
	}
	const arrivalWindow = getArrivalWindow(
		insertionCase,
		windows,
		0,
		busStopWindow,
		approachDuration,
		returnDuration,
		allowedTimes
	);
	if (arrivalWindow == undefined) {
		return undefined;
	}
	const passengerDuration =
		(insertionCase.what == InsertWhat.BUS_STOP) ==
		(insertionCase.direction == InsertDirection.BUS_STOP_PICKUP)
			? returnDuration - PASSENGER_CHANGE_DURATION
			: approachDuration;
	if (
		promisedTimes != undefined &&
		!keepsPromises(insertionCase, arrivalWindow, passengerDuration, promisedTimes)
	) {
		return undefined;
	}
	const taxiDuration =
		approachDuration + returnDuration - getOldDrivingTime(insertionCase, prev, next);
	console.assert(insertionCase.what != InsertWhat.BOTH);
	const time = isEarlierBetter(insertionCase) ? arrivalWindow.startTime : arrivalWindow.endTime;
	const taxiWaitingTime = getTaxiWaitingDelta(
		approachDuration + returnDuration,
		insertionCase,
		new Date(time - approachDuration).getTime(),
		new Date(time + returnDuration).getTime(),
		prev,
		next
	);
	const sie: SingleInsertionEvaluation = {
		time,
		window: arrivalWindow,
		approachDuration: approachDuration,
		returnDuration: returnDuration,
		case: structuredClone(insertionCase),
		passengerDuration,
		taxiDuration,
		taxiWaitingTime,
		cost: computeCost(passengerDuration, taxiDuration, taxiWaitingTime)
	};
	return sie;
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
	allowedTimes: Interval[],
	promisedTimes?: PromisedTimes
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
	if (
		promisedTimes != undefined &&
		!keepsPromises(insertionCase, arrivalWindow, passengerDuration, promisedTimes)
	) {
		return undefined;
	}
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
	allowedTimes: Interval[],
	promisedTimes?: PromisedTimes
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
	const prepTime = Date.now() + MIN_PREP;

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
						allowedTimes,
						promisedTimes
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

export function evaluateSingleInsertions(
	companies: Company[],
	startFixed: boolean,
	expandedSearchInterval: Interval,
	insertionRanges: Map<number, Range[]>,
	busStopTimes: Interval[][],
	routingResults: RoutingResults,
	travelDurations: (number | undefined)[],
	allowedTimes: Interval[],
	promisedTimes?: PromisedTimes
): Evaluations {
	const bothEvaluations: (Insertion | undefined)[][] = [];
	const userChosenEvaluations: (SingleInsertionEvaluation | undefined)[] = [];
	const busStopEvaluations: (SingleInsertionEvaluation | undefined)[][][] = new Array<
		(SingleInsertionEvaluation | undefined)[][]
	>(busStopTimes.length);
	for (let i = 0; i != busStopTimes.length; ++i) {
		busStopEvaluations[i] = new Array<(SingleInsertionEvaluation | undefined)[]>(
			busStopTimes[i].length
		);
		for (let j = 0; j != busStopTimes[i].length; ++j) {
			busStopEvaluations[i][j] = new Array<SingleInsertionEvaluation | undefined>();
		}
		bothEvaluations[i] = new Array<Insertion | undefined>(busStopTimes[i].length);
	}
	const prepTime = new Date(Date.now() + MINUTE * MIN_PREP).getTime();
	const direction = startFixed ? InsertDirection.BUS_STOP_PICKUP : InsertDirection.BUS_STOP_DROPOFF;

	iterateAllInsertions(
		companies,
		insertionRanges,
		(insertionInfo: InsertionInfo, insertionCounter: number) => {
			const prev: Event | undefined =
				insertionInfo.idxInEvents == 0
					? insertionInfo.vehicle.lastEventBefore
					: insertionInfo.vehicle.events[insertionInfo.idxInEvents - 1];
			const next: Event | undefined =
				insertionInfo.idxInEvents == insertionInfo.vehicle.events.length
					? insertionInfo.vehicle.firstEventAfter
					: insertionInfo.vehicle.events[insertionInfo.idxInEvents];
			INSERT_HOW_OPTIONS.forEach((insertHow) => {
				const insertionCase = {
					how: insertHow,
					where:
						insertionInfo.idxInEvents == 0
							? InsertWhere.BEFORE_FIRST_EVENT
							: insertionInfo.idxInEvents == insertionInfo.vehicle.events.length
								? InsertWhere.AFTER_LAST_EVENT
								: prev!.tourId != next!.tourId
									? InsertWhere.BETWEEN_TOURS
									: InsertWhere.BETWEEN_EVENTS,
					what: InsertWhat.BUS_STOP,
					direction
				};
				if (!canCaseBeValid(insertionCase)) {
					return undefined;
				}
				const windows = getAllowedOperationTimes(
					insertionCase,
					prev,
					next,
					expandedSearchInterval,
					prepTime,
					insertionInfo.vehicle
				);
				for (let busStopIdx = 0; busStopIdx != busStopTimes.length; ++busStopIdx) {
					for (let busTimeIdx = 0; busTimeIdx != busStopTimes[busStopIdx].length; ++busTimeIdx) {
						insertionCase.what = InsertWhat.BOTH;
						const resultBoth = evaluateBothInsertion(
							insertionCase,
							windows,
							travelDurations[busStopIdx],
							busStopTimes[busStopIdx][busTimeIdx],
							routingResults,
							insertionInfo,
							busStopIdx,
							prev,
							next,
							allowedTimes,
							promisedTimes
						);
						if (
							resultBoth != undefined &&
							(bothEvaluations[busStopIdx][busTimeIdx] == undefined ||
								resultBoth.cost < bothEvaluations[busStopIdx][busTimeIdx]!.cost)
						) {
							bothEvaluations[busStopIdx][busTimeIdx] = {
								...resultBoth,
								company: insertionInfo.companyIdx,
								vehicle: insertionInfo.vehicle.id,
								tour: insertionCase.how == InsertHow.APPEND ? prev!.tourId : next!.tourId,
								pickupIdx: insertionInfo.idxInEvents,
								dropoffIdx: insertionInfo.idxInEvents
							};
						}

						insertionCase.what = InsertWhat.BUS_STOP;
						if (!isCaseValid(insertionCase)) {
							continue;
						}
						const resultBus = evaluateSingleInsertion(
							insertionCase,
							windows,
							busStopTimes[busStopIdx][busTimeIdx],
							routingResults,
							insertionInfo,
							busStopIdx,
							prev,
							next,
							allowedTimes,
							promisedTimes
						);
						if (
							resultBus != undefined &&
							(busStopEvaluations[busStopIdx][busTimeIdx] == undefined ||
								busStopEvaluations[busStopIdx][busTimeIdx][insertionCounter] == undefined ||
								resultBus.cost < busStopEvaluations[busStopIdx][busTimeIdx][insertionCounter]!.cost)
						) {
							busStopEvaluations[busStopIdx][busTimeIdx][insertionCounter] = resultBus;
						}
					}
				}
				insertionCase.what = InsertWhat.USER_CHOSEN;
				if (!isCaseValid(insertionCase)) {
					return;
				}
				const resultUserChosen = evaluateSingleInsertion(
					insertionCase,
					windows,
					undefined,
					routingResults,
					insertionInfo,
					undefined,
					prev,
					next,
					allowedTimes,
					promisedTimes
				);
				if (
					resultUserChosen != undefined &&
					(userChosenEvaluations[insertionCounter] == undefined ||
						resultUserChosen.cost < userChosenEvaluations[insertionCounter].cost)
				) {
					userChosenEvaluations[insertionCounter] = resultUserChosen;
				}
			});
		}
	);
	return { busStopEvaluations, userChosenEvaluations, bothEvaluations };
}

export function evaluatePairInsertions(
	companies: Company[],
	startFixed: boolean,
	insertionRanges: Map<number, Range[]>,
	busStopTimes: Interval[][],
	busStopEvaluations: (SingleInsertionEvaluation | undefined)[][][],
	userChosenEvaluations: (SingleInsertionEvaluation | undefined)[]
): (Insertion | undefined)[][] {
	const bestEvaluations: (Insertion | undefined)[][] = new Array<(Insertion | undefined)[]>(
		busStopTimes.length
	);
	for (let i = 0; i != busStopTimes.length; ++i) {
		bestEvaluations[i] = new Array<Insertion | undefined>(busStopTimes[i].length);
	}
	iterateAllInsertions(
		companies,
		insertionRanges,
		(insertionInfo: InsertionInfo, _insertionCounter: number) => {
			const events = insertionInfo.vehicle.events;
			const pickupIdx = insertionInfo.idxInEvents;
			let cumulatedTaxiDrivingDelta = 0;
			let cumulatedTaxiWaitingDelta = 0;
			let pickupInvalid = false;
			for (
				let dropoffIdx = pickupIdx + 1;
				dropoffIdx != insertionInfo.currentRange.latestDropoff + 1;
				++dropoffIdx
			) {
				if (pickupInvalid) {
					break;
				}
				for (let busStopIdx = 0; busStopIdx != busStopTimes.length; ++busStopIdx) {
					if (pickupInvalid) {
						break;
					}
					for (let timeIdx = 0; timeIdx != busStopTimes[busStopIdx].length; ++timeIdx) {
						const pickup = startFixed
							? busStopEvaluations[busStopIdx][timeIdx][pickupIdx]
							: userChosenEvaluations[pickupIdx];
						if (pickup == undefined) {
							pickupInvalid = true;
							break;
						}
						const dropoff = startFixed
							? userChosenEvaluations[dropoffIdx]
							: busStopEvaluations[busStopIdx][timeIdx][dropoffIdx];
						if (dropoff == undefined) {
							continue;
						}
						const passengerDuration = dropoff.time! - pickup.time!;

						const taxiDuration =
							pickup.taxiDuration + dropoff.taxiDuration + cumulatedTaxiDrivingDelta;
						const taxiWaitingTime =
							dropoff.taxiWaitingTime + pickup.taxiWaitingTime + cumulatedTaxiWaitingDelta;
						const cost = computeCost(passengerDuration, taxiDuration, taxiWaitingTime);
						if (
							bestEvaluations[busStopIdx][timeIdx] == undefined ||
							cost < bestEvaluations[busStopIdx][timeIdx]!.cost
						) {
							const tour = events[pickupIdx].tourId;
							bestEvaluations[busStopIdx][timeIdx] = {
								pickupTime: pickup.time,
								dropoffTime: dropoff.time,
								pickupCase: pickup.case,
								dropoffCase: dropoff.case,
								pickupIdx,
								dropoffIdx,
								taxiWaitingTime,
								taxiDuration,
								passengerDuration,
								cost,
								company: insertionInfo.companyIdx,
								vehicle: insertionInfo.vehicle.id,
								tour,
								departure: comesFromCompany(pickup.case)
									? new Date(pickup.time - pickup.approachDuration).getTime()
									: undefined,
								arrival: returnsToCompany(dropoff.case)
									? new Date(dropoff.time + dropoff.returnDuration).getTime()
									: undefined,
								pickupPrevLegDuration: pickup.approachDuration,
								pickupNextLegDuration: pickup.returnDuration,
								dropoffPrevLegDuration: dropoff.approachDuration,
								dropoffNextLegDuration: dropoff.returnDuration
							};
						}
					}
				}
				const prevDropoffIdx = dropoffIdx - 1;
				if (
					dropoffIdx != events.length &&
					events[prevDropoffIdx].tourId != events[dropoffIdx].tourId
				) {
					const drivingTime = events[dropoffIdx].directDuration;
					if (drivingTime == null) {
						return;
					}
					cumulatedTaxiDrivingDelta +=
						drivingTime -
						events[dropoffIdx].nextLegDuration -
						events[prevDropoffIdx].prevLegDuration;
					cumulatedTaxiWaitingDelta +=
						events[dropoffIdx].communicatedTime -
						events[prevDropoffIdx].communicatedTime -
						drivingTime;
				}
			}
		}
	);
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

const keepsPromises = (
	insertionCase: InsertionType,
	arrivalWindow: Interval,
	directDuration: number,
	promisedTimes: PromisedTimes
): boolean => {
	const expandToFullMinutes = (interval: Interval) => {
		return new Interval(
			roundToUnit(interval.startTime, MINUTE, Math.floor),
			roundToUnit(interval.endTime, MINUTE, Math.ceil)
		);
	};
	const w = arrivalWindow.shift(
		insertionCase.direction == InsertDirection.BUS_STOP_PICKUP ? directDuration : -directDuration
	);
	const pickupWindow = expandToFullMinutes(
		insertionCase.direction == InsertDirection.BUS_STOP_PICKUP ? arrivalWindow : w
	);
	const dropoffWindow = expandToFullMinutes(
		insertionCase.direction == InsertDirection.BUS_STOP_DROPOFF ? arrivalWindow : w
	);

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

export const takeBest = (
	evals1: (Insertion | undefined)[][],
	evals2: (Insertion | undefined)[][]
): (Insertion | undefined)[][] => {
	const takeBetter = (e1: Insertion | undefined, e2: Insertion | undefined) => {
		if (e1 == undefined) {
			return e2;
		}
		if (e2 == undefined) {
			return e1;
		}
		return e1.cost < e2.cost ? e1 : e2;
	};
	console.assert(
		evals1.length == evals2.length,
		'in takeBest, evaluations do not have matching length.'
	);
	const result = new Array<(Insertion | undefined)[]>(evals1.length);
	for (let busStopIdx = 0; busStopIdx != evals1.length; ++busStopIdx) {
		console.assert(
			evals1[busStopIdx].length == evals2[busStopIdx].length,
			"in takeBest, evaluations' inner arrays do not have matching length."
		);
		result[busStopIdx] = new Array<Insertion | undefined>(evals1[busStopIdx].length);
		for (let timeIdx = 0; timeIdx != evals1[busStopIdx].length; ++timeIdx) {
			const e1 = evals1[busStopIdx][timeIdx];
			const e2 = evals2[busStopIdx][timeIdx];
			result[busStopIdx][timeIdx] = takeBetter(e1, e2);
		}
	}
	return result;
};
