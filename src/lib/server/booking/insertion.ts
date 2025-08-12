import {
	MAX_PASSENGER_WAITING_TIME_DROPOFF,
	MAX_PASSENGER_WAITING_TIME_PICKUP,
	MIN_PREP,
	PASSENGER_TIME_COST_FACTOR,
	APPROACH_AND_RETURN_TIME_COST_FACTOR,
	TAXI_WAITING_TIME_COST_FACTOR,
	FULLY_PAYED_COST_FACTOR,
	MAX_WAITING_TIME
} from '$lib/constants';
import {
	INSERT_HOW_OPTIONS,
	InsertDirection,
	InsertWhere,
	type InsertionInfo,
	type InsertionType,
	canCaseBeValid,
	isCaseValid,
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
import { InsertHow, InsertWhat } from '$lib/util/booking/insertionTypes';

export type InsertionEvaluation = {
	pickupTime: number;
	dropoffTime: number;
	scheduledPickupTimeStart: number;
	scheduledPickupTimeEnd: number;
	scheduledDropoffTimeStart: number;
	scheduledDropoffTimeEnd: number;
	pickupCase: InsertionType;
	dropoffCase: InsertionType;
	taxiWaitingTime: number;
	approachPlusReturnDurationDelta: number;
	fullyPayedDurationDelta: number;
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
	prevPickupId: number | undefined;
	nextPickupId: number | undefined;
	prevDropoffId: number | undefined;
	nextDropoffId: number | undefined;
	pickupIdxInEvents: number | undefined;
	dropoffIdxInEvents: number | undefined;
};

type SingleInsertionEvaluation = {
	window: Interval;
	prevLegDuration: number;
	nextLegDuration: number;
	case: InsertionType;
	taxiWaitingTime: number;
	approachPlusReturnDurationDelta: number;
	fullyPayedDurationDelta: number;
	cost: number;
	prevId: number | undefined;
	nextId: number | undefined;
	idxInEvents: number;
	time: number;
};

type Evaluations = {
	busStopEvaluations: (SingleInsertionEvaluation | undefined)[][][];
	userChosenEvaluations: (SingleInsertionEvaluation | undefined)[];
	bothEvaluations: (Insertion | undefined)[][];
};

export type NeighbourIds = {
	prevPickup: number | undefined;
	prevPickupGroup: number | undefined;
	nextPickup: number | undefined;
	nextPickupGroup: number | undefined;
	prevDropoff: number | undefined;
	prevDropoffGroup: number | undefined;
	nextDropoff: number | undefined;
	nextDropoffGroup: number | undefined;
};

export function toInsertionWithISOStrings(i: Insertion | undefined) {
	return i === undefined
		? undefined
		: {
				...i,
				pickupTime: new Date(i.pickupTime).toISOString(),
				dropoffTime: new Date(i.dropoffTime).toISOString(),
				scheduledPickupTimeStart: new Date(i.scheduledPickupTimeStart).toISOString(),
				scheduledPickupTimeEnd: new Date(i.scheduledPickupTimeEnd).toISOString(),
				scheduledDropoffTimeStart: new Date(i.scheduledDropoffTimeStart).toISOString(),
				scheduledDropoffTimeEnd: new Date(i.scheduledDropoffTimeEnd).toISOString(),
				departure: i.departure == undefined ? undefined : new Date(i.departure).toISOString(),
				arrival: i.arrival == undefined ? undefined : new Date(i.arrival).toISOString()
			};
}

function isPickup(type: InsertionType) {
	if (type.what === InsertWhat.BOTH) {
		return false;
	}
	return (
		(type.what === InsertWhat.BUS_STOP) === (type.direction === InsertDirection.BUS_STOP_PICKUP)
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
	const events = insertionInfo.vehicle.events;
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
	if (prevLegDuration == undefined || nextLegDuration == undefined) {
		return undefined;
	}
	const arrivalWindow = getArrivalWindow(
		insertionCase,
		windows,
		0,
		busStopWindow,
		prevLegDuration,
		nextLegDuration,
		allowedTimes
	);
	if (arrivalWindow == undefined) {
		return undefined;
	}
	const passengerDuration =
		(insertionCase.what == InsertWhat.BUS_STOP) ==
		(insertionCase.direction == InsertDirection.BUS_STOP_PICKUP)
			? nextLegDuration
			: prevLegDuration;
	if (
		promisedTimes != undefined &&
		!keepsPromises(insertionCase, arrivalWindow, passengerDuration, promisedTimes)
	) {
		console.log(
			'Promise not kept',
			printInsertionType(insertionCase),
			{ prev: prev?.id },
			{ next: next?.id }
		);
		return undefined;
	}
	const taxiDurationDelta =
		prevLegDuration + nextLegDuration - getOldDrivingTime(insertionCase, prev, next);
	console.assert(insertionCase.what != InsertWhat.BOTH);
	const communicatedTime = isPickup(insertionCase)
		? promisedTimes !== undefined && arrivalWindow.covers(promisedTimes.pickup)
			? promisedTimes.pickup
			: arrivalWindow.startTime
		: promisedTimes !== undefined && arrivalWindow.covers(promisedTimes.dropoff)
			? promisedTimes.dropoff
			: arrivalWindow.endTime;

	const scheduledTimeCandidate = // TODO
		communicatedTime +
		(isPickup(insertionCase)
			? Math.min(arrivalWindow.size(), MAX_PASSENGER_WAITING_TIME_PICKUP)
			: -Math.min(arrivalWindow.size(), MAX_PASSENGER_WAITING_TIME_DROPOFF));
	let newEndTimePrev = undefined;
	if (
		!comesFromCompany(insertionCase) &&
		prev!.isPickup &&
		communicatedTime - prev!.scheduledTimeEnd - prevLegDuration < 0
	) {
		newEndTimePrev = communicatedTime - prevLegDuration;
	}
	let newStartTimeNext = undefined;
	if (
		!returnsToCompany(insertionCase) &&
		!next!.isPickup &&
		communicatedTime - next!.scheduledTimeEnd - nextLegDuration < 0
	) {
		newStartTimeNext = communicatedTime + nextLegDuration;
	}
	const prevShift =
		newEndTimePrev !== undefined ? getScheduledEventTime(prev!) - newEndTimePrev : 0;
	const nextShift =
		newStartTimeNext !== undefined ? newStartTimeNext - getScheduledEventTime(next!) : 0;
	const taxiWaitingTime = getWaitingTimeDelta(
		insertionCase,
		scheduledTimeCandidate,
		scheduledTimeCandidate,
		prevLegDuration,
		nextLegDuration,
		prev,
		next,
		events,
		0,
		0,
		prevShift,
		nextShift,
		taxiDurationDelta
	);
	const passengersEnteringInPrev =
		!comesFromCompany(insertionCase) && prev!.isPickup ? prev!.passengers : 0;
	const passengerExitingAtNext =
		!returnsToCompany(insertionCase) && !next!.isPickup ? next!.passengers : 0;
	const weightedPassengerDuration =
		passengersEnteringInPrev * prevShift + passengerExitingAtNext * nextShift;

	const approachPlusReturnDurationDelta = getApproachPlusReturnDurationDelta(
		insertionCase,
		prev,
		next,
		prevLegDuration,
		nextLegDuration
	);
	const fullyPayedDurationDelta = taxiDurationDelta - approachPlusReturnDurationDelta;
	const cost = computeCost(
		weightedPassengerDuration,
		approachPlusReturnDurationDelta,
		fullyPayedDurationDelta,
		taxiWaitingTime
	);
	const sie: SingleInsertionEvaluation = {
		window: arrivalWindow,
		prevLegDuration: prevLegDuration,
		nextLegDuration: nextLegDuration,
		case: structuredClone(insertionCase),
		fullyPayedDurationDelta,
		approachPlusReturnDurationDelta,
		taxiWaitingTime,
		cost,
		prevId: prev?.id,
		nextId: next?.id,
		time: scheduledTimeCandidate,
		idxInEvents: insertionInfo.idxInVehicleEvents
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
	passengerCountNewRequest: number,
	promisedTimes?: PromisedTimes
): InsertionEvaluation | undefined {
	console.assert(
		insertionCase.what == InsertWhat.BOTH,
		'Not inserting both in evaluateBothInsertion.'
	);
	const events = insertionInfo.vehicle.events;
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
		console.log('duration undefined: ', prevLegDuration, nextLegDuration, passengerDuration);
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
		console.log(
			promisedTimes === undefined ? 'WHITELIST' : 'BOOKING API',
			'arrival window undefined',
			printInsertionType(insertionCase),
			{ windows: windows.toString() },
			{ passengerDuration: passengerDuration.toString() },
			{ busStopWindow: busStopWindow?.toString() },
			{ prevLegDuration: prevLegDuration.toString() },
			{ nextLegDuration: nextLegDuration.toString() },
			{ allowedTimes: allowedTimes.toString() },
			{ prev: prev?.id },
			{ next: next?.id }
		);
		return undefined;
	}
	if (
		promisedTimes != undefined &&
		!keepsPromises(insertionCase, arrivalWindow, passengerDuration, promisedTimes)
	) {
		console.log(
			'promise not kept',
			promisedTimes,
			printInsertionType(insertionCase),
			{ prev: prev?.id },
			{ next: next?.id }
		);
		return undefined;
	}
	const taxiDurationDelta =
		prevLegDuration +
		nextLegDuration +
		passengerDuration -
		getOldDrivingTime(insertionCase, prev, next);

	// Determine new scheduled and communicated times
	const pickupLeeway = (() => {
		switch (insertionCase.how) {
			case InsertHow.APPEND:
				return 0;
			case InsertHow.PREPEND:
				return Math.min(arrivalWindow.size(), MAX_PASSENGER_WAITING_TIME_PICKUP);
			case InsertHow.INSERT:
				return 0;
			case InsertHow.NEW_TOUR:
				return Math.min(Math.floor(arrivalWindow.size() / 2), MAX_PASSENGER_WAITING_TIME_PICKUP);
			case InsertHow.CONNECT:
				return 0;
		}
	})();
	const dropoffLeeway = (() => {
		switch (insertionCase.how) {
			case InsertHow.APPEND:
				return Math.min(arrivalWindow.size(), MAX_PASSENGER_WAITING_TIME_DROPOFF);
			case InsertHow.PREPEND:
				return 0;
			case InsertHow.INSERT:
				return 0;
			case InsertHow.NEW_TOUR:
				return Math.min(Math.floor(arrivalWindow.size() / 2), MAX_PASSENGER_WAITING_TIME_DROPOFF);
			case InsertHow.CONNECT:
				return 0;
		}
	})();
	const {
		communicatedPickupTime,
		scheduledPickupTimeStart,
		scheduledPickupTimeEnd,
		communicatedDropoffTime,
		scheduledDropoffTimeStart,
		scheduledDropoffTimeEnd
	} = getTimestamps(
		insertionCase,
		arrivalWindow,
		promisedTimes,
		prev,
		next,
		prevLegDuration,
		nextLegDuration,
		passengerDuration,
		pickupLeeway,
		dropoffLeeway
	);
	// Compute shifts of scheduled time intervals of previous and next event
	let prevShift = 0;
	if (!comesFromCompany(insertionCase) && prev!.isPickup) {
		prevShift = Math.max(
			getScheduledEventTime(prev!) - communicatedPickupTime + prevLegDuration,
			0
		);
	}
	let nextShift = 0;
	if (!returnsToCompany(insertionCase) && !next!.isPickup) {
		nextShift = Math.max(
			communicatedDropoffTime + nextLegDuration - getScheduledEventTime(next!),
			0
		);
	}

	const weightedPassengerDuration =
		passengerCountNewRequest * (scheduledDropoffTimeStart - scheduledPickupTimeEnd) +
		getWeightedPassengerDurationDelta(insertionCase, prev, next, prevShift, nextShift);
	const departure = comesFromCompany(insertionCase)
		? scheduledPickupTimeEnd - prevLegDuration
		: undefined;
	const arrival = returnsToCompany(insertionCase)
		? scheduledDropoffTimeStart + nextLegDuration
		: undefined;

	const taxiWaitingTime = getWaitingTimeDelta(
		insertionCase,
		scheduledPickupTimeEnd,
		scheduledDropoffTimeStart,
		prevLegDuration,
		nextLegDuration,
		prev,
		next,
		events,
		arrival,
		departure,
		prevShift,
		nextShift,
		taxiDurationDelta
	);

	const approachPlusReturnDurationDelta = getApproachPlusReturnDurationDelta(
		insertionCase,
		prev,
		next,
		prevLegDuration,
		nextLegDuration
	);
	const fullyPayedDurationDelta = getFullyPayedDurationDelta(
		insertionCase,
		prev,
		next,
		prevLegDuration,
		nextLegDuration,
		passengerDuration
	);
	const cost = computeCost(
		weightedPassengerDuration,
		approachPlusReturnDurationDelta,
		fullyPayedDurationDelta,
		taxiWaitingTime
	);
	console.log(
		promisedTimes === undefined ? 'WHITELIST' : 'BOOKING API',
		'valid insertion found,',
		printInsertionType(insertionCase),
		{ prevId: prev?.id },
		{ nextId: next?.id },
		{ cost },
		{ weightedPassengerDuration },
		{ fullyPayedDurationDelta },
		{ approachPlusReturnDurationDelta },
		{ taxiWaitingTime }
	);
	return {
		pickupTime: communicatedPickupTime,
		dropoffTime: communicatedDropoffTime,
		scheduledPickupTimeStart,
		scheduledPickupTimeEnd,
		scheduledDropoffTimeStart,
		scheduledDropoffTimeEnd,
		pickupCase: structuredClone(insertionCase),
		dropoffCase: structuredClone(insertionCase),
		passengerDuration: weightedPassengerDuration,
		approachPlusReturnDurationDelta,
		fullyPayedDurationDelta,
		taxiWaitingTime,
		cost,
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
	let prepTime = Date.now() + MIN_PREP;
	const now = new Date();
	const isWeekend =
		(now.getDay() == 5 && now.getHours() >= 18) || now.getDay() == 6 || now.getDay() == 0;
	if (isWeekend) {
		const nextMonday = new Date();
		nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7));
		nextMonday.setHours(10);
		nextMonday.setMinutes(0);
		nextMonday.setSeconds(0);
		prepTime = nextMonday.getTime();
	}

	companies.forEach((company, companyIdx) => {
		company.vehicles.forEach((vehicle) => {
			const insertionInfo: InsertionInfo = {
				companyIdx,
				vehicle,
				idxInVehicleEvents: -1,
				currentRange: { earliestPickup: 0, latestDropoff: 0 },
				insertionIdx: -1
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
						required.passengers,
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
							dropoffIdx: undefined,
							prevPickupId: undefined,
							nextPickupId: undefined,
							prevDropoffId: undefined,
							nextDropoffId: undefined,
							pickupIdxInEvents: undefined,
							dropoffIdxInEvents: undefined
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
	required: Capacities,
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
	const prepTime = Date.now() + MIN_PREP;
	const direction = startFixed ? InsertDirection.BUS_STOP_PICKUP : InsertDirection.BUS_STOP_DROPOFF;

	iterateAllInsertions(companies, insertionRanges, (insertionInfo: InsertionInfo) => {
		const events = insertionInfo.vehicle.events;
		const prev: Event | undefined =
			insertionInfo.idxInVehicleEvents == 0
				? insertionInfo.vehicle.lastEventBefore
				: events[insertionInfo.idxInVehicleEvents - 1];
		const next: Event | undefined =
			insertionInfo.idxInVehicleEvents == events.length
				? insertionInfo.vehicle.firstEventAfter
				: events[insertionInfo.idxInVehicleEvents];
		INSERT_HOW_OPTIONS.forEach((insertHow) => {
			const insertionCase = {
				how: insertHow,
				where:
					insertionInfo.idxInVehicleEvents == 0
						? InsertWhere.BEFORE_FIRST_EVENT
						: insertionInfo.idxInVehicleEvents == events.length
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

			// Ensure shifting the previous or next events' scheduledTime does not cause the whole tour to be prolonged too much
			if (insertHow === InsertHow.INSERT && prev && next && windows.length != 0) {
				const twoBefore =
					events[insertionInfo.idxInVehicleEvents - 2] ?? insertionInfo.vehicle.lastEventBefore;
				if (twoBefore && twoBefore?.tourId != prev.tourId) {
					const tourDifference = prev.departure - twoBefore.arrival;
					const scheduledTimeLength = prev.scheduledTimeEnd - prev.scheduledTimeStart;
					windows[0].startTime += Math.max(0, scheduledTimeLength - tourDifference);
				}
				const twoAfter =
					events[insertionInfo.idxInVehicleEvents + 1] ?? insertionInfo.vehicle.firstEventAfter;
				if (twoAfter && twoAfter?.tourId != next.tourId && windows.length != 0) {
					const tourDifference = twoAfter.departure - next.arrival;
					const scheduledTimeLength = next.scheduledTimeEnd - next.scheduledTimeStart;
					windows[0].endTime -= Math.max(0, scheduledTimeLength - tourDifference);
				}
			}
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
						required.passengers,
						promisedTimes
					);
					if (
						resultBoth != undefined &&
						(bothEvaluations[busStopIdx][busTimeIdx] == undefined ||
							resultBoth.cost < bothEvaluations[busStopIdx][busTimeIdx]!.cost) &&
						!waitsTooLong(resultBoth.taxiWaitingTime)
					) {
						bothEvaluations[busStopIdx][busTimeIdx] = {
							...resultBoth,
							company: insertionInfo.companyIdx,
							vehicle: insertionInfo.vehicle.id,
							tour: insertionCase.how == InsertHow.APPEND ? prev!.tourId : next!.tourId,
							pickupIdx: insertionInfo.idxInVehicleEvents,
							dropoffIdx: insertionInfo.idxInVehicleEvents,
							prevPickupId: prev?.id,
							nextPickupId: next?.id,
							prevDropoffId: prev?.id,
							nextDropoffId: next?.id,
							pickupIdxInEvents: insertionInfo.idxInVehicleEvents,
							dropoffIdxInEvents: insertionInfo.idxInVehicleEvents
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
							busStopEvaluations[busStopIdx][busTimeIdx][insertionInfo.insertionIdx] == undefined ||
							resultBus.cost <
								busStopEvaluations[busStopIdx][busTimeIdx][insertionInfo.insertionIdx]!.cost) &&
						!waitsTooLong(resultBus.taxiWaitingTime)
					) {
						busStopEvaluations[busStopIdx][busTimeIdx][insertionInfo.insertionIdx] = resultBus;
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
				(userChosenEvaluations[insertionInfo.insertionIdx] == undefined ||
					resultUserChosen.cost < userChosenEvaluations[insertionInfo.insertionIdx]!.cost) &&
				!waitsTooLong(resultUserChosen.taxiWaitingTime)
			) {
				userChosenEvaluations[insertionInfo.insertionIdx] = resultUserChosen;
			}
		});
	});
	return { busStopEvaluations, userChosenEvaluations, bothEvaluations };
}

export function evaluatePairInsertions(
	companies: Company[],
	startFixed: boolean,
	insertionRanges: Map<number, Range[]>,
	busStopTimes: Interval[][],
	busStopEvaluations: (SingleInsertionEvaluation | undefined)[][][],
	userChosenEvaluations: (SingleInsertionEvaluation | undefined)[],
	required: Capacities,
	whitelist?: boolean
): (Insertion | undefined)[][] {
	const bestEvaluations: (Insertion | undefined)[][] = new Array<(Insertion | undefined)[]>(
		busStopTimes.length
	);
	for (let i = 0; i != busStopTimes.length; ++i) {
		bestEvaluations[i] = new Array<Insertion | undefined>(busStopTimes[i].length);
	}
	iterateAllInsertions(companies, insertionRanges, (insertionInfo: InsertionInfo) => {
		const events = insertionInfo.vehicle.events;
		const pickupIdx = insertionInfo.idxInVehicleEvents;
		const prevPickup = events[pickupIdx - 1];
		const twoBeforePickup = events[pickupIdx - 2];
		const nextPickup = events[pickupIdx];
		const twoAfterPickup = events[pickupIdx + 1];
		if (
			pickupIdx < events.length - 1 &&
			nextPickup?.tourId !== twoAfterPickup?.tourId &&
			twoAfterPickup.scheduledTimeEnd -
				nextPickup.scheduledTimeStart -
				twoAfterPickup.directDuration! <
				0
		) {
			return;
		}
		let cumulatedTaxiDrivingDelta = 0;
		let pickupInvalid = false;
		for (
			let dropoffIdx = pickupIdx + 1;
			dropoffIdx != insertionInfo.currentRange.latestDropoff + 1;
			++dropoffIdx
		) {
			if (pickupInvalid) {
				break;
			}
			const prevDropoffIdx = dropoffIdx - 1;
			if (
				dropoffIdx > 1 &&
				prevDropoffIdx !== pickupIdx &&
				dropoffIdx != events.length &&
				events[prevDropoffIdx].tourId != events[dropoffIdx - 2].tourId
			) {
				const drivingTime = events[prevDropoffIdx].directDuration;
				if (drivingTime == null) {
					return;
				}
				cumulatedTaxiDrivingDelta +=
					drivingTime -
					events[prevDropoffIdx].prevLegDuration -
					events[dropoffIdx - 2].nextLegDuration;
			}
			for (let busStopIdx = 0; busStopIdx != busStopTimes.length; ++busStopIdx) {
				if (pickupInvalid) {
					break;
				}
				for (let timeIdx = 0; timeIdx != busStopTimes[busStopIdx].length; ++timeIdx) {
					const pickup = startFixed
						? busStopEvaluations[busStopIdx][timeIdx][insertionInfo.insertionIdx]
						: userChosenEvaluations[insertionInfo.insertionIdx];
					if (pickup == undefined) {
						pickupInvalid = true;
						break;
					}

					const dropoff = startFixed
						? userChosenEvaluations[insertionInfo.insertionIdx + dropoffIdx - pickupIdx]
						: busStopEvaluations[busStopIdx][timeIdx][
								insertionInfo.insertionIdx + dropoffIdx - pickupIdx
							];
					if (dropoff == undefined) {
						continue;
					}
					const prevDropoff = events[dropoffIdx - 1];
					const nextDropoff = events[dropoffIdx];
					const twoAfterDropoff = events[dropoffIdx + 1];
					const communicatedPickupTime = Math.max(
						pickup.window.endTime - MAX_PASSENGER_WAITING_TIME_PICKUP,
						pickup.window.startTime
					);
					const communicatedDropoffTime = Math.min(
						dropoff.window.startTime + MAX_PASSENGER_WAITING_TIME_DROPOFF,
						dropoff.window.endTime
					);

					// Verify, that the shift induced to other events by pickup and dropoff are mutually compatible
					if (dropoffIdx < pickupIdx + 3) {
						let availableDistance =
							communicatedDropoffTime -
							communicatedPickupTime -
							dropoff.prevLegDuration -
							pickup.nextLegDuration;
						if (pickupIdx + 2 === dropoffIdx) {
							availableDistance -=
								nextPickup.tourId !== prevDropoff.tourId
									? (prevDropoff.directDuration ?? Number.MAX_SAFE_INTEGER / 2)
									: prevDropoff.prevLegDuration;
						}
						if (availableDistance - 2 < 0) {
							continue;
						}
					}

					// Determine the scheduled times for pickup and dropoff
					const leewayBetweenPickupDropoff =
						communicatedDropoffTime -
						communicatedPickupTime -
						pickup.nextLegDuration -
						dropoff.prevLegDuration;
					const pickupScheduledShift = Math.min(
						pickup.window.size(),
						MAX_PASSENGER_WAITING_TIME_PICKUP,
						leewayBetweenPickupDropoff
					);
					const scheduledPickupTime =
						communicatedPickupTime +
						(pickup.case.how === InsertHow.APPEND ? 0 : pickupScheduledShift);
					const scheduledDropoffTime =
						communicatedDropoffTime -
						(dropoff.case.how === InsertHow.PREPEND
							? 0
							: Math.min(
									dropoff.window.size(),
									MAX_PASSENGER_WAITING_TIME_DROPOFF,
									leewayBetweenPickupDropoff - pickupScheduledShift // TODO
								));

					// Compute the delta of the taxi's time spend driving for the tour containing the new request
					const approachPlusReturnDurationDelta =
						pickup.approachPlusReturnDurationDelta + dropoff.approachPlusReturnDurationDelta;
					const fullyPayedDurationDelta =
						pickup.fullyPayedDurationDelta +
						dropoff.fullyPayedDurationDelta +
						cumulatedTaxiDrivingDelta;

					// Compute the delta of the taxi's waiting time
					const newDeparture = comesFromCompany(pickup.case)
						? scheduledPickupTime - pickup.prevLegDuration
						: prevPickup.tourId !== twoBeforePickup?.tourId
							? Math.min(
									communicatedPickupTime - pickup.prevLegDuration,
									getScheduledEventTime(prevPickup)
								) - prevPickup.prevLegDuration
							: prevPickup.departure;
					const newArrival = returnsToCompany(dropoff.case)
						? scheduledDropoffTime + dropoff.nextLegDuration
						: nextDropoff.tourId !== twoAfterDropoff?.tourId
							? Math.max(
									communicatedDropoffTime + dropoff.nextLegDuration,
									getScheduledEventTime(nextDropoff)
								) + nextDropoff.nextLegDuration
							: nextDropoff.arrival;
					const relevantEvents = events.slice(
						pickup.case.how === InsertHow.CONNECT ? pickupIdx - 1 : pickupIdx,
						dropoff.case.how === InsertHow.CONNECT ? dropoffIdx + 1 : dropoffIdx
					);
					const tours = new Set<number>();
					let oldTourDurationSum = 0;
					relevantEvents.forEach((e) => {
						if (!tours.has(e.tourId)) {
							oldTourDurationSum += e.arrival - e.departure;
							tours.add(e.tourId);
						}
					});
					const tourDurationDelta = newArrival - newDeparture - oldTourDurationSum;
					const taxiWaitingTime =
						tourDurationDelta - approachPlusReturnDurationDelta - fullyPayedDurationDelta;
					if (waitsTooLong(taxiWaitingTime)) {
						continue;
					}

					// Compute the delta of the duration spend by passengers in the taxi
					let prevShiftPickup = 0;
					if (!comesFromCompany(pickup.case) && prevPickup!.isPickup) {
						prevShiftPickup = Math.max(
							0,
							getScheduledEventTime(prevPickup!) - communicatedPickupTime + pickup.prevLegDuration
						);
					}
					let nextShiftPickup = 0;
					if (!returnsToCompany(pickup.case) && !nextPickup!.isPickup) {
						nextShiftPickup = Math.max(
							0,
							scheduledPickupTime + pickup.nextLegDuration - getScheduledEventTime(nextPickup!)
						);
					}
					let prevShiftDropoff = 0;
					if (!comesFromCompany(dropoff.case) && prevDropoff!.isPickup) {
						prevShiftDropoff = Math.max(
							0,
							getScheduledEventTime(prevDropoff!) - scheduledDropoffTime + dropoff.prevLegDuration
						);
					}
					let nextShiftDropoff = 0;
					if (!returnsToCompany(dropoff.case) && !nextDropoff!.isPickup) {
						nextShiftDropoff = Math.max(
							0,
							communicatedDropoffTime +
								dropoff.nextLegDuration -
								getScheduledEventTime(nextDropoff!)
						);
					}

					let weightedPassengerDuration =
						required.passengers * (scheduledDropoffTime - scheduledPickupTime);
					weightedPassengerDuration += getWeightedPassengerDurationDelta(
						pickup.case,
						prevPickup,
						nextPickup,
						prevShiftPickup,
						nextShiftPickup
					);
					weightedPassengerDuration += getWeightedPassengerDurationDelta(
						dropoff.case,
						prevDropoff,
						nextDropoff,
						prevShiftDropoff,
						nextShiftDropoff
					);

					// Compute the cost used to compare to other insertion options
					const cost = computeCost(
						weightedPassengerDuration,
						approachPlusReturnDurationDelta,
						fullyPayedDurationDelta,
						taxiWaitingTime
					);

					console.log(
						whitelist ? 'WHITELIST' : 'BOOKING API',
						'valid insertion found,',
						'pickup: ',
						printInsertionType(pickup.case),
						'dropoff: ',
						printInsertionType(dropoff.case),
						{ prevPickupId: prevPickup?.id },
						{ nextPickupId: nextPickup?.id },
						{ prevDropoffId: prevDropoff?.id },
						{ nextDropoffId: nextDropoff?.id },
						{ cost },
						{ weightedPassengerDuration },
						{ taxiWaitingTime }
					);
					if (
						bestEvaluations[busStopIdx][timeIdx] == undefined ||
						cost < bestEvaluations[busStopIdx][timeIdx]!.cost
					) {
						const tour = events[pickupIdx].tourId;
						bestEvaluations[busStopIdx][timeIdx] = {
							pickupTime: communicatedPickupTime,
							dropoffTime: communicatedDropoffTime,
							scheduledPickupTimeEnd: scheduledPickupTime,
							scheduledPickupTimeStart: communicatedPickupTime,
							scheduledDropoffTimeStart: scheduledDropoffTime,
							scheduledDropoffTimeEnd: communicatedDropoffTime,
							pickupCase: structuredClone(pickup.case),
							dropoffCase: structuredClone(dropoff.case),
							pickupIdx,
							dropoffIdx,
							taxiWaitingTime,
							approachPlusReturnDurationDelta,
							fullyPayedDurationDelta,
							passengerDuration: weightedPassengerDuration,
							cost,
							company: insertionInfo.companyIdx,
							vehicle: insertionInfo.vehicle.id,
							tour,
							departure: comesFromCompany(pickup.case)
								? new Date(scheduledPickupTime - pickup.prevLegDuration).getTime()
								: undefined,
							arrival: returnsToCompany(dropoff.case)
								? new Date(scheduledDropoffTime + dropoff.nextLegDuration).getTime()
								: undefined,
							pickupPrevLegDuration: pickup.prevLegDuration,
							pickupNextLegDuration: pickup.nextLegDuration,
							dropoffPrevLegDuration: dropoff.prevLegDuration,
							dropoffNextLegDuration: dropoff.nextLegDuration,
							prevPickupId: pickup.prevId,
							nextPickupId: pickup.nextId,
							prevDropoffId: dropoff.prevId,
							nextDropoffId: dropoff.nextId,
							pickupIdxInEvents: pickup.idxInEvents,
							dropoffIdxInEvents: dropoff.idxInEvents
						};
					}
				}
			}
		}
	});
	return bestEvaluations;
}

export const computeCost = (
	passengerDuration: number,
	approachPlusReturnDurationDelta: number,
	fullyPayedDurationDelta: number,
	taxiWaitingTime: number
) => {
	return (
		APPROACH_AND_RETURN_TIME_COST_FACTOR * approachPlusReturnDurationDelta +
		FULLY_PAYED_COST_FACTOR * fullyPayedDurationDelta +
		PASSENGER_TIME_COST_FACTOR * passengerDuration +
		TAXI_WAITING_TIME_COST_FACTOR * taxiWaitingTime
	);
};

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
	if (comesFromCompany(insertionCase)) {
		console.assert(
			insertionCase.how == InsertHow.PREPEND,
			'getOldDrivingTime: no previous but also no prepend'
		);
		return next!.prevLegDuration;
	}
	return prev!.nextLegDuration;
};

const expandToFullMinutes = (interval: Interval) => {
	return new Interval(
		roundToUnit(interval.startTime, MINUTE, Math.floor),
		roundToUnit(interval.endTime, MINUTE, Math.ceil)
	);
};

const keepsPromises = (
	insertionCase: InsertionType,
	arrivalWindow: Interval,
	directDuration: number,
	promisedTimes: PromisedTimes
): boolean => {
	const shift = insertionCase.what === InsertWhat.BOTH ? directDuration : 0;
	const w = arrivalWindow.shift(
		insertionCase.direction == InsertDirection.BUS_STOP_PICKUP ? shift : -shift
	);
	const pickupWindow = expandToFullMinutes(
		insertionCase.direction == InsertDirection.BUS_STOP_PICKUP
			? arrivalWindow
			: w.shift(-MAX_PASSENGER_WAITING_TIME_PICKUP)
	);
	const dropoffWindow = expandToFullMinutes(
		insertionCase.direction == InsertDirection.BUS_STOP_DROPOFF
			? arrivalWindow
			: w.shift(MAX_PASSENGER_WAITING_TIME_PICKUP)
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

function getWaitingTimeDelta(
	type: InsertionType,
	pickupTime: number,
	dropoffTime: number,
	prevLegDuration: number,
	nextLegDuration: number,
	prev: Event | undefined,
	next: Event | undefined,
	events: Event[],
	arrival: number | undefined,
	departure: number | undefined,
	prevShift: number,
	nextShift: number,
	taxiDurationDelta: number
) {
	const tourDurationDelta = (() => {
		switch (type.how) {
			case InsertHow.APPEND:
				return dropoffTime + nextLegDuration - prev!.arrival;
			case InsertHow.PREPEND:
				return next!.departure - pickupTime + prevLegDuration;
			case InsertHow.INSERT: {
				let delta = 0;
				const twoBefore =
					prev === undefined ? undefined : events[events.findIndex((e) => e.id === prev.id) - 1];
				const twoAfter =
					next === undefined ? undefined : events[events.findIndex((e) => e.id === next.id) + 1];
				if (prev && prevShift && twoBefore?.tourId !== prev.tourId) {
					delta += prevShift;
				}
				if (next && nextShift && twoAfter?.tourId !== next.tourId) {
					delta += nextShift;
				}
				return delta;
			}
			case InsertHow.NEW_TOUR:
				return arrival! - departure!;
			case InsertHow.CONNECT:
				return next!.departure - prev!.arrival;
		}
	})();
	return tourDurationDelta - taxiDurationDelta;
}

function getWeightedPassengerDurationDelta(
	type: InsertionType,
	prev: Event | undefined,
	next: Event | undefined,
	prevShift: number,
	nextShift: number
) {
	const passengersEnteringInPrev = !comesFromCompany(type) && prev!.isPickup ? prev!.passengers : 0;
	const passengerExitingAtNext = !returnsToCompany(type) && !next!.isPickup ? next!.passengers : 0;
	return passengersEnteringInPrev * prevShift + passengerExitingAtNext * nextShift;
}

function getApproachPlusReturnDurationDelta(
	type: InsertionType,
	prev: Event | undefined,
	next: Event | undefined,
	prevLegDuration: number,
	nextLegDuration: number
) {
	const oldApproachPlusReturnDuration = (() => {
		switch (type.how) {
			case InsertHow.APPEND:
				return prev!.nextLegDuration;
			case InsertHow.PREPEND:
				return next!.prevLegDuration;
			case InsertHow.INSERT:
				return 0;
			case InsertHow.NEW_TOUR:
				return 0;
			case InsertHow.CONNECT:
				return next!.prevLegDuration + prev!.nextLegDuration;
		}
	})();
	const newApproachPlusReturnDuration = (() => {
		switch (type.how) {
			case InsertHow.APPEND:
				return nextLegDuration;
			case InsertHow.PREPEND:
				return prevLegDuration;
			case InsertHow.INSERT:
				return 0;
			case InsertHow.NEW_TOUR:
				return prevLegDuration + nextLegDuration;
			case InsertHow.CONNECT:
				return 0;
		}
	})();
	return newApproachPlusReturnDuration - oldApproachPlusReturnDuration;
}

function getFullyPayedDurationDelta(
	type: InsertionType,
	prev: Event | undefined,
	next: Event | undefined,
	prevLegDuration: number,
	nextLegDuration: number,
	passengerDuration: number
) {
	const oldFullyPayedDuration = (() => {
		switch (type.how) {
			case InsertHow.APPEND:
				return 0;
			case InsertHow.PREPEND:
				return 0;
			case InsertHow.INSERT:
				return prev!.nextLegDuration;
			case InsertHow.NEW_TOUR:
				return 0;
			case InsertHow.CONNECT:
				return 0;
		}
	})();
	const newFullyPayedDuration = (() => {
		switch (type.how) {
			case InsertHow.APPEND:
				return prevLegDuration + passengerDuration;
			case InsertHow.PREPEND:
				return nextLegDuration + passengerDuration;
			case InsertHow.INSERT:
				return prevLegDuration + passengerDuration + nextLegDuration;
			case InsertHow.NEW_TOUR:
				return passengerDuration;
			case InsertHow.CONNECT:
				return prevLegDuration + passengerDuration + nextLegDuration;
		}
	})();
	return newFullyPayedDuration - oldFullyPayedDuration;
}

function clampTimestamps(
	scheduledPickupTimeStart: number,
	scheduledPickupTimeEnd: number,
	scheduledDropoffTimeStart: number,
	scheduledDropoffTimeEnd: number,
	promisedTimes: PromisedTimes | undefined,
	direction: InsertDirection
): {
	communicatedPickupTime: number;
	scheduledPickupTimeStart: number;
	scheduledPickupTimeEnd: number;
	communicatedDropoffTime: number;
	scheduledDropoffTimeStart: number;
	scheduledDropoffTimeEnd: number;
} {
	if (direction == InsertDirection.BUS_STOP_PICKUP) {
		return {
			communicatedPickupTime: promisedTimes?.pickup ?? scheduledPickupTimeStart,
			scheduledPickupTimeStart,
			scheduledPickupTimeEnd,
			communicatedDropoffTime:
				promisedTimes?.dropoff ?? scheduledDropoffTimeStart + MAX_PASSENGER_WAITING_TIME_DROPOFF,
			scheduledDropoffTimeStart,
			scheduledDropoffTimeEnd
		};
	}
	return {
		communicatedPickupTime:
			promisedTimes?.pickup ?? scheduledPickupTimeEnd - MAX_PASSENGER_WAITING_TIME_PICKUP,
		scheduledPickupTimeStart,
		scheduledPickupTimeEnd,
		communicatedDropoffTime: promisedTimes?.dropoff ?? scheduledDropoffTimeEnd,
		scheduledDropoffTimeStart,
		scheduledDropoffTimeEnd
	};
}

function getTimestamps(
	insertionCase: InsertionType,
	window: Interval,
	promisedTimes: PromisedTimes | undefined,
	prev: Event | undefined,
	next: Event | undefined,
	prevLegDuration: number,
	nextLegDuration: number,
	passengerDuration: number,
	pickupLeeway: number,
	dropoffLeeway: number
): {
	communicatedPickupTime: number;
	scheduledPickupTimeStart: number;
	scheduledPickupTimeEnd: number;
	communicatedDropoffTime: number;
	scheduledDropoffTimeStart: number;
	scheduledDropoffTimeEnd: number;
} {
	const prevIsSameEventGroup =
		prev &&
		prevLegDuration === 0 &&
		prev.time.overlaps(window) &&
		(!promisedTimes ||
			expandToFullMinutes(prev.time).overlaps(
				new Interval(promisedTimes.pickup, promisedTimes.pickup + MAX_PASSENGER_WAITING_TIME_PICKUP)
			));
	const nextIsSameEventGroup =
		next &&
		nextLegDuration === 0 &&
		next.time.overlaps(window) &&
		(!promisedTimes ||
			expandToFullMinutes(next.time).overlaps(
				new Interval(
					promisedTimes.dropoff,
					promisedTimes.dropoff + MAX_PASSENGER_WAITING_TIME_DROPOFF
				)
			));
	if (prevIsSameEventGroup) {
		const scheduledPickupTimeStart = Math.max(
			prev.scheduledTimeStart,
			promisedTimes?.pickup ?? -1,
			window.startTime
		);
		const scheduledPickupTimeEnd = scheduledPickupTimeStart + pickupLeeway;
		const scheduledDropoffTimeStart = scheduledPickupTimeEnd + passengerDuration;
		const scheduledDropoffTimeEnd = scheduledDropoffTimeStart + dropoffLeeway;
		return clampTimestamps(
			scheduledPickupTimeStart,
			scheduledPickupTimeEnd,
			scheduledDropoffTimeStart,
			scheduledDropoffTimeEnd,
			promisedTimes,
			insertionCase.direction
		);
	}
	if (nextIsSameEventGroup) {
		const scheduledDropoffTimeEnd = Math.min(
			next.scheduledTimeStart,
			promisedTimes?.dropoff ?? Number.MAX_VALUE,
			window.endTime
		);
		const scheduledDropoffTimeStart = scheduledDropoffTimeEnd - dropoffLeeway;
		const scheduledPickupTimeEnd = scheduledDropoffTimeStart - passengerDuration;
		const scheduledPickupTimeStart = scheduledPickupTimeEnd - pickupLeeway;
		return clampTimestamps(
			scheduledPickupTimeStart,
			scheduledPickupTimeEnd,
			scheduledDropoffTimeStart,
			scheduledDropoffTimeEnd,
			promisedTimes,
			insertionCase.direction
		);
	}
	if (insertionCase.direction == InsertDirection.BUS_STOP_PICKUP) {
		const scheduledPickupTimeStart =
			promisedTimes === undefined || !window.covers(promisedTimes.pickup)
				? window.startTime
				: promisedTimes.pickup;
		const scheduledPickupTimeEnd = scheduledPickupTimeStart + pickupLeeway;
		const scheduledDropoffTimeStart = scheduledPickupTimeEnd + passengerDuration;
		const scheduledDropoffTimeEnd = scheduledDropoffTimeStart + dropoffLeeway;
		return clampTimestamps(
			scheduledPickupTimeStart,
			scheduledPickupTimeEnd,
			scheduledDropoffTimeStart,
			scheduledDropoffTimeEnd,
			promisedTimes,
			insertionCase.direction
		);
	}
	const scheduledDropoffTimeEnd =
		promisedTimes === undefined || !window.covers(promisedTimes.dropoff)
			? window.endTime
			: promisedTimes.dropoff;
	const scheduledDropoffTimeStart = scheduledDropoffTimeEnd - dropoffLeeway;
	const scheduledPickupTimeEnd = scheduledDropoffTimeStart - passengerDuration;
	const scheduledPickupTimeStart = scheduledPickupTimeEnd - pickupLeeway;
	return clampTimestamps(
		scheduledPickupTimeStart,
		scheduledPickupTimeEnd,
		scheduledDropoffTimeStart,
		scheduledDropoffTimeEnd,
		promisedTimes,
		insertionCase.direction
	);
}

function waitsTooLong(waitingTime: number) {
	return waitingTime > MAX_WAITING_TIME;
}
