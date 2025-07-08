import {
	MIN_PREP,
	PASSENGER_TIME_COST_FACTOR,
	SCHEDULED_TIME_BUFFER,
	TAXI_DRIVING_TIME_COST_FACTOR,
	TAXI_WAITING_TIME_COST_FACTOR
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
import { bookingLogs, iteration } from '$lib/testHelpers';

export type InsertionEvaluation = {
	pickupTime: number;
	dropoffTime: number;
	scheduledPickupTime: number;
	scheduledDropoffTime: number;
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
	prevPickupId: number | undefined;
	nextPickupId: number | undefined;
	prevDropoffId: number | undefined;
	nextDropoffId: number | undefined;
	pickupIdxInEvents: number | undefined;
	dropoffIdxInEvents: number | undefined;
};

type SingleInsertionEvaluation = {
	window: Interval;
	approachDuration: number;
	returnDuration: number;
	case: InsertionType;
	taxiWaitingTime: number;
	taxiDuration: number;
	passengerDuration: number;
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
				scheduledPickupTime: new Date(i.scheduledPickupTime).toISOString(),
				scheduledDropoffTime: new Date(i.scheduledDropoffTime).toISOString(),
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
		console.log('Promise not kept', printInsertionType(insertionCase));
		return undefined;
	}
	const taxiDurationDelta =
		prevLegDuration + nextLegDuration - getOldDrivingTime(insertionCase, prev, next);
	console.assert(insertionCase.what != InsertWhat.BOTH);
	const communicatedTime =
		promisedTimes === undefined
			? arrivalWindow.startTime
			: isPickup(insertionCase)
				? arrivalWindow.covers(promisedTimes.pickup)
					? promisedTimes.pickup
					: arrivalWindow.startTime
				: arrivalWindow.covers(promisedTimes.dropoff)
					? promisedTimes.dropoff
					: arrivalWindow.endTime;
	const scheduledShift = Math.min(arrivalWindow.size(), SCHEDULED_TIME_BUFFER);
	const scheduledTimeCandidate =
		communicatedTime + (isPickup(insertionCase) ? scheduledShift : -scheduledShift);
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
	const sie: SingleInsertionEvaluation = {
		window: arrivalWindow,
		approachDuration: prevLegDuration,
		returnDuration: nextLegDuration,
		case: structuredClone(insertionCase),
		passengerDuration: weightedPassengerDuration,
		taxiDuration: taxiDurationDelta,
		taxiWaitingTime,
		cost: computeCost(weightedPassengerDuration, taxiDurationDelta, taxiWaitingTime),
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
	console.log(
		promisedTimes === undefined ? 'WHITELIST' : 'BOOKING API',
		'start of bothevaluation',
		printInsertionType(insertionCase)
	);
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
			{ allowedTimes: allowedTimes.toString() }
		);
		return undefined;
	}
	if (
		promisedTimes != undefined &&
		!keepsPromises(insertionCase, arrivalWindow, passengerDuration, promisedTimes)
	) {
		console.log('promise not kept', promisedTimes);
		return undefined;
	}
	const taxiDurationDelta =
		prevLegDuration +
		nextLegDuration +
		passengerDuration -
		getOldDrivingTime(insertionCase, prev, next);
	const leeway = Math.min(arrivalWindow.size(), SCHEDULED_TIME_BUFFER);

	let communicatedPickupTime = -1;
	let communicatedDropoffTime = -1;
	let pickupScheduledEndTime = -1;
	let dropoffScheduledStartTime = -1;
	const pickupLeeway = (() => {
		switch (insertionCase.how) {
			case InsertHow.APPEND:
				return 0;
			case InsertHow.PREPEND:
				return leeway;
			case InsertHow.INSERT:
				return 0;
			case InsertHow.NEW_TOUR:
				return Math.floor(leeway / 2);
			case InsertHow.CONNECT:
				return 0;
		}
	})();
	const dropoffLeeway = (() => {
		switch (insertionCase.how) {
			case InsertHow.APPEND:
				return leeway;
			case InsertHow.PREPEND:
				return 0;
			case InsertHow.INSERT:
				return 0;
			case InsertHow.NEW_TOUR:
				return Math.floor(leeway / 2);
			case InsertHow.CONNECT:
				return 0;
		}
	})();
	if (insertionCase.direction == InsertDirection.BUS_STOP_PICKUP) {
		communicatedPickupTime =
			promisedTimes === undefined
				? arrivalWindow.startTime
				: arrivalWindow.covers(promisedTimes.pickup)
					? promisedTimes.pickup
					: arrivalWindow.startTime;
		pickupScheduledEndTime = communicatedPickupTime + pickupLeeway;
		dropoffScheduledStartTime = pickupScheduledEndTime + passengerDuration;
		communicatedDropoffTime = dropoffScheduledStartTime + dropoffLeeway;
	} else {
		communicatedDropoffTime =
			promisedTimes === undefined
				? arrivalWindow.endTime
				: arrivalWindow.covers(promisedTimes.dropoff)
					? promisedTimes.dropoff
					: arrivalWindow.endTime;
		dropoffScheduledStartTime = communicatedDropoffTime - dropoffLeeway;
		pickupScheduledEndTime = dropoffScheduledStartTime - passengerDuration;
		communicatedPickupTime = pickupScheduledEndTime - pickupLeeway;
	}

	let newEndTimePrev = undefined;
	if (
		!comesFromCompany(insertionCase) &&
		prev!.isPickup &&
		communicatedPickupTime - prev!.scheduledTimeEnd - prevLegDuration < 0
	) {
		newEndTimePrev = Math.min(communicatedPickupTime - prevLegDuration, prev!.scheduledTimeStart);
	}
	let newStartTimeNext = undefined;
	if (
		!returnsToCompany(insertionCase) &&
		!next!.isPickup &&
		communicatedDropoffTime - next!.scheduledTimeEnd - nextLegDuration < 0
	) {
		newStartTimeNext = Math.max(
			communicatedDropoffTime + nextLegDuration,
			next!.scheduledTimeStart
		);
	}

	const prevShift =
		newEndTimePrev !== undefined ? getScheduledEventTime(prev!) - newEndTimePrev : 0;
	const nextShift =
		newStartTimeNext !== undefined ? newStartTimeNext - getScheduledEventTime(next!) : 0;

	let weightedPassengerDuration =
		passengerCountNewRequest * (dropoffScheduledStartTime - pickupScheduledEndTime);
	weightedPassengerDuration += getWeightedPassengerDurationDelta(
		insertionCase,
		prev,
		next,
		prevShift,
		nextShift
	);
	const departure = comesFromCompany(insertionCase)
		? pickupScheduledEndTime - prevLegDuration
		: undefined;
	const arrival = returnsToCompany(insertionCase)
		? dropoffScheduledStartTime + nextLegDuration
		: undefined;

	const taxiWaitingTime = getWaitingTimeDelta(
		insertionCase,
		pickupScheduledEndTime,
		dropoffScheduledStartTime,
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

	let eventOverlap = 0;
	const window = new Interval(pickupScheduledEndTime, dropoffScheduledStartTime);
	if (prev && insertionCase.how !== InsertHow.APPEND) {
		eventOverlap += window.intersect(prev.time)?.size() ?? 0;
	}
	if (next && insertionCase.how !== InsertHow.PREPEND) {
		eventOverlap += window.intersect(next.time)?.size() ?? 0;
	}
	const cost = computeCost(
		weightedPassengerDuration + eventOverlap,
		taxiDurationDelta,
		taxiWaitingTime
	);
	bookingLogs.push({
		type: printInsertionType(insertionCase),
		prevEvent: prev?.id,
		nextEvent: next?.id,
		prevLegDuration,
		nextLegDuration,
		cost,
		iter: iteration,
		waitingTime: taxiWaitingTime,
		taxiDuration: taxiDurationDelta,
		oldDrivingTime: getOldDrivingTime(insertionCase, prev, next),
		passengerDuration: passengerDuration + eventOverlap,
		weightedPassengerDuration,
		eventOverlap,
		whitelist: promisedTimes === undefined
	});
	console.log(
		promisedTimes === undefined ? 'WHITELIST' : 'BOOKING API',
		'bothevaluation',
		printInsertionType(insertionCase),
		{ pickupTime: pickupScheduledEndTime.toString() },
		{ dropoffTime: dropoffScheduledStartTime.toString() }
	);
	return {
		pickupTime: communicatedPickupTime,
		dropoffTime: communicatedDropoffTime,
		scheduledPickupTime: pickupScheduledEndTime,
		scheduledDropoffTime: dropoffScheduledStartTime,
		pickupCase: structuredClone(insertionCase),
		dropoffCase: structuredClone(insertionCase),
		passengerDuration: weightedPassengerDuration,
		taxiDuration: taxiDurationDelta,
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
							resultBoth.cost < bothEvaluations[busStopIdx][busTimeIdx]!.cost)
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
								busStopEvaluations[busStopIdx][busTimeIdx][insertionInfo.insertionIdx]!.cost)
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
					resultUserChosen.cost < userChosenEvaluations[insertionInfo.insertionIdx]!.cost)
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
	required: Capacities
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
		let cumulatedTaxiWaitingDelta = 0;
		let spansMultipleTours = false;
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
				dropoffIdx != events.length &&
				events[prevDropoffIdx].tourId != events[dropoffIdx].tourId
			) {
				const drivingTime = events[dropoffIdx].directDuration;
				if (drivingTime == null) {
					return;
				}
				cumulatedTaxiDrivingDelta +=
					drivingTime - events[dropoffIdx].prevLegDuration - events[prevDropoffIdx].nextLegDuration;
				cumulatedTaxiWaitingDelta +=
					getScheduledEventTime(events[dropoffIdx]) -
					getScheduledEventTime(events[prevDropoffIdx]) -
					drivingTime;
				spansMultipleTours = true;
			}
			if (pickupIdx === dropoffIdx - 1) {
				continue;
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
						pickup.window.endTime - SCHEDULED_TIME_BUFFER,
						pickup.window.startTime
					);
					const communicatedDropoffTime = Math.min(
						dropoff.window.startTime + SCHEDULED_TIME_BUFFER,
						dropoff.window.endTime
					);
					if (dropoffIdx < pickupIdx + 3) {
						let availableDistance =
							communicatedDropoffTime -
							communicatedPickupTime -
							dropoff.approachDuration -
							pickup.returnDuration;
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
					const window = new Interval(communicatedPickupTime, communicatedDropoffTime);
					let eventOverlap = 0;
					if (pickupIdx !== 0 && window.covers(prevPickup.scheduledTimeEnd)) {
						eventOverlap += window.intersect(prevPickup.time)?.size() ?? 0;
					}
					if (pickupIdx < events.length - 1 && window.covers(twoAfterPickup.scheduledTimeStart)) {
						eventOverlap += window.intersect(twoAfterPickup.time)?.size() ?? 0;
					}
					if (dropoffIdx !== 0 && window.covers(prevDropoff.scheduledTimeEnd)) {
						eventOverlap += window.intersect(prevDropoff.time)?.size() ?? 0;
					}
					if (dropoffIdx < events.length - 1 && window.covers(twoAfterDropoff.scheduledTimeStart)) {
						eventOverlap += window.intersect(twoAfterDropoff.time)?.size() ?? 0;
					}

					const leewayBetweenPickupDropoff =
						communicatedDropoffTime -
						communicatedPickupTime -
						pickup.returnDuration -
						dropoff.approachDuration;
					const pickupScheduledShift = Math.min(
						pickup.window.size(),
						SCHEDULED_TIME_BUFFER,
						leewayBetweenPickupDropoff
					);
					const scheduledPickupTime = communicatedPickupTime + pickupScheduledShift;
					const scheduledDropoffTime =
						communicatedDropoffTime -
						Math.min(
							dropoff.window.size(),
							SCHEDULED_TIME_BUFFER,
							leewayBetweenPickupDropoff - pickupScheduledShift
						);

					const taxiDuration =
						pickup.taxiDuration + dropoff.taxiDuration + cumulatedTaxiDrivingDelta;
					const passengerDuration = scheduledDropoffTime! - scheduledPickupTime! + eventOverlap;

					let newEndTimePrevPickup = undefined;
					if (
						!comesFromCompany(pickup.case) &&
						prevPickup!.isPickup &&
						communicatedPickupTime - prevPickup!.scheduledTimeEnd - pickup.approachDuration < 0
					) {
						newEndTimePrevPickup = communicatedPickupTime - pickup.approachDuration;
					}
					let newStartTimeNextPickup = undefined;
					if (
						!returnsToCompany(pickup.case) &&
						!nextPickup!.isPickup &&
						communicatedPickupTime - nextPickup!.scheduledTimeEnd - pickup.returnDuration < 0
					) {
						newStartTimeNextPickup = communicatedPickupTime + pickup.returnDuration;
					}

					let newEndTimePrevDropoff = undefined;
					if (
						!comesFromCompany(dropoff.case) &&
						prevDropoff!.isPickup &&
						communicatedDropoffTime - prevDropoff!.scheduledTimeEnd - dropoff.approachDuration < 0
					) {
						newEndTimePrevDropoff = communicatedDropoffTime - dropoff.approachDuration;
					}
					let newStartTimeNextDropoff = undefined;
					if (
						!returnsToCompany(dropoff.case) &&
						!nextDropoff!.isPickup &&
						communicatedDropoffTime - nextDropoff!.scheduledTimeEnd - dropoff.returnDuration < 0
					) {
						newStartTimeNextDropoff = communicatedDropoffTime + dropoff.returnDuration;
					}

					const prevShiftPickup =
						newEndTimePrevPickup !== undefined
							? getScheduledEventTime(prevPickup!) - newEndTimePrevPickup
							: 0;
					const nextShiftPickup =
						newStartTimeNextPickup !== undefined
							? newStartTimeNextPickup - getScheduledEventTime(nextPickup!)
							: 0;
					const prevShiftDropoff =
						newEndTimePrevDropoff !== undefined
							? getScheduledEventTime(prevDropoff!) - newEndTimePrevDropoff
							: 0;
					const nextShiftDropoff =
						newStartTimeNextDropoff !== undefined
							? newStartTimeNextDropoff - getScheduledEventTime(nextDropoff!)
							: 0;

					let taxiWaitingTime =
						dropoff.taxiWaitingTime + pickup.taxiWaitingTime + cumulatedTaxiWaitingDelta;
					console.log({ taxiWaitingTime });
					if (pickup.case.how === InsertHow.PREPEND) {
						taxiWaitingTime += -scheduledPickupTime + pickup.time;
					}
					if (dropoff.case.how === InsertHow.APPEND) {
						taxiWaitingTime += -scheduledDropoffTime + dropoff.time;
					}
					if (
						spansMultipleTours &&
						pickupIdx + 2 != events.length &&
						events[pickupIdx + 2].tourId !== nextPickup.tourId
					) {
						taxiWaitingTime -= nextShiftPickup;
					}
					if (
						spansMultipleTours &&
						dropoffIdx != 2 &&
						events[dropoffIdx - 2].tourId !== prevDropoff.tourId
					) {
						taxiWaitingTime -= prevShiftDropoff;
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
					const cost = computeCost(weightedPassengerDuration, taxiDuration, taxiWaitingTime);

					bookingLogs.push({
						pickupType: printInsertionType(pickup.case),
						dropoffType: printInsertionType(dropoff.case),
						pickupPrevLegDuration: pickup.approachDuration,
						pickupNextLegDuration: pickup.returnDuration,
						dropoffPrevLegDuration: dropoff.approachDuration,
						dropoffNextLegDuration: dropoff.returnDuration,
						cost,
						iter: iteration,
						pickupWaitingTime: pickup.taxiWaitingTime,
						dropoffWaitingTime: dropoff.taxiWaitingTime,
						pickupTaxiDuration: pickup.taxiDuration,
						dropoffTaxiDuration: dropoff.taxiDuration,
						waitingTime: taxiWaitingTime,
						taxiDuration,
						cumulatedTaxiDrivingDelta,
						passengerDuration,
						pickupTime: communicatedPickupTime,
						dropoffTime: scheduledDropoffTime,
						pickupNextId: pickup.nextId,
						dropoffPrevId: dropoff.prevId,
						weightedPassengerDuration
					});
					if (
						bestEvaluations[busStopIdx][timeIdx] == undefined ||
						cost < bestEvaluations[busStopIdx][timeIdx]!.cost
					) {
						const tour = events[pickupIdx].tourId;
						bestEvaluations[busStopIdx][timeIdx] = {
							pickupTime: communicatedPickupTime,
							dropoffTime: communicatedDropoffTime,
							scheduledPickupTime,
							scheduledDropoffTime,
							pickupCase: structuredClone(pickup.case),
							dropoffCase: structuredClone(dropoff.case),
							pickupIdx,
							dropoffIdx,
							taxiWaitingTime,
							taxiDuration,
							passengerDuration: weightedPassengerDuration,
							cost,
							company: insertionInfo.companyIdx,
							vehicle: insertionInfo.vehicle.id,
							tour,
							departure: comesFromCompany(pickup.case)
								? new Date(scheduledPickupTime - pickup.approachDuration).getTime()
								: undefined,
							arrival: returnsToCompany(dropoff.case)
								? new Date(scheduledDropoffTime + dropoff.returnDuration).getTime()
								: undefined,
							pickupPrevLegDuration: pickup.approachDuration,
							pickupNextLegDuration: pickup.returnDuration,
							dropoffPrevLegDuration: dropoff.approachDuration,
							dropoffNextLegDuration: dropoff.returnDuration,
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
	taxiDuration: number,
	taxiWaitingTime: number
) => {
	return (
		TAXI_DRIVING_TIME_COST_FACTOR * taxiDuration +
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
	const shift = insertionCase.what === InsertWhat.BOTH ? directDuration : 0;
	const w = arrivalWindow.shift(
		insertionCase.direction == InsertDirection.BUS_STOP_PICKUP ? shift : -shift
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
