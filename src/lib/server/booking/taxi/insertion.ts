import { SCHEDULED_TIME_BUFFER_PICKUP } from '$lib/constants';
import {
	InsertDirection,
	type InsertionInfo,
	type InsertionType,
	printInsertionType
} from '../insertionTypes';
import {
	comesFromCompany,
	getPrevLegDuration,
	getArrivalWindow,
	getNextLegDuration,
	returnsToCompany
} from './durations';
import type { PromisedTimes } from './PromisedTimes';
import { Interval } from '$lib/util/interval';
import type { RoutingResults } from './routing';
import type { Event } from './getBookingAvailability';
import { getScheduledEventTime } from '$lib/util/getScheduledEventTime';
import { roundToUnit, MINUTE } from '$lib/util/time';
import { InsertHow, InsertWhat } from '$lib/util/booking/insertionTypes';
import { getScheduledTimeBufferDropoff } from '$lib/util/getScheduledTimeBuffer';
import { computeCost, getWeightedPassengerDurationDelta } from './insertionMetrics';

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

export type SingleInsertionEvaluation = {
	arrivalWindow: Interval;
	prevLegDuration: number;
	nextLegDuration: number;
	insertionType: InsertionType;
	taxiWaitingTime: number;
	approachPlusReturnDurationDelta: number;
	fullyPayedDurationDelta: number;
	cost: number;
	previousEventId: number | undefined;
	nextEventId: number | undefined;
	eventInsertionIndex: number;
};

export class SingleInsertionEvaluations {
	private readonly busStop: SingleInsertionEvaluation[][][][];
	private readonly userChosen: SingleInsertionEvaluation[][];

	constructor(busStopTimes: Interval[][], insertionPointCount: number) {
		this.busStop = busStopTimes.map((times) =>
			times.map(() =>
				Array.from({ length: insertionPointCount }, () => new Array<SingleInsertionEvaluation>())
			)
		);
		this.userChosen = Array.from(
			{ length: insertionPointCount },
			() => new Array<SingleInsertionEvaluation>()
		);
	}

	addBusStop(
		busStopIdx: number,
		busTimeIdx: number,
		insertionIdx: number,
		evaluation: SingleInsertionEvaluation
	): void {
		this.busStop[busStopIdx][busTimeIdx][insertionIdx].push(evaluation);
	}

	addUserChosen(insertionIdx: number, evaluation: SingleInsertionEvaluation): void {
		this.userChosen[insertionIdx].push(evaluation);
	}

	getBusStop(
		busStopIdx: number,
		busTimeIdx: number,
		insertionIdx: number
	): SingleInsertionEvaluation[] {
		return this.busStop[busStopIdx][busTimeIdx][insertionIdx];
	}

	getUserChosen(insertionIdx: number): SingleInsertionEvaluation[] {
		return this.userChosen[insertionIdx];
	}
}

export type Evaluations = {
	singleEvaluations: SingleInsertionEvaluations;
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
		nextLegDuration
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
			? Math.min(arrivalWindow.size(), SCHEDULED_TIME_BUFFER_PICKUP)
			: -Math.min(arrivalWindow.size(), getScheduledTimeBufferDropoff(passengerDuration)));
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
	const evaluation: SingleInsertionEvaluation = {
		arrivalWindow,
		prevLegDuration,
		nextLegDuration,
		insertionType: structuredClone(insertionCase),
		fullyPayedDurationDelta,
		approachPlusReturnDurationDelta,
		taxiWaitingTime,
		cost,
		previousEventId: prev?.id,
		nextEventId: next?.id,
		eventInsertionIndex: insertionInfo.idxInVehicleEvents
	};
	return evaluation;
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
		nextLegDuration
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
	if (promisedTimes) {
		if (insertionCase.direction === InsertDirection.BUS_STOP_PICKUP) {
			arrivalWindow.startTime = Math.min(
				Math.max(promisedTimes.pickup, arrivalWindow.startTime),
				arrivalWindow.endTime
			);
		} else {
			arrivalWindow.endTime = Math.max(
				Math.min(promisedTimes.dropoff, arrivalWindow.endTime),
				arrivalWindow.startTime
			);
		}
	}
	const taxiDurationDelta =
		prevLegDuration +
		nextLegDuration +
		passengerDuration -
		getOldDrivingTime(insertionCase, prev, next);

	// Determine new scheduled and communicated times
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
		passengerDuration
	);
	// Compute shifts of scheduled time intervals of previous and next event
	let prevShift = 0;
	if (!comesFromCompany(insertionCase) && prev!.isPickup) {
		prevShift = Math.max(
			getScheduledEventTime(prev!) - scheduledPickupTimeEnd + prevLegDuration,
			0
		);
	}
	let nextShift = 0;
	if (!returnsToCompany(insertionCase) && !next!.isPickup) {
		nextShift = Math.max(
			scheduledDropoffTimeStart + nextLegDuration - getScheduledEventTime(next!),
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

export { computeCost } from './insertionMetrics';

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

function getTimestamps(
	insertionCase: InsertionType,
	window: Interval,
	promisedTimes: PromisedTimes | undefined,
	prev: Event | undefined,
	next: Event | undefined,
	prevLegDuration: number,
	nextLegDuration: number,
	passengerDuration: number
): {
	communicatedPickupTime: number;
	scheduledPickupTimeStart: number;
	scheduledPickupTimeEnd: number;
	communicatedDropoffTime: number;
	scheduledDropoffTimeStart: number;
	scheduledDropoffTimeEnd: number;
} {
	let scheduledPickupTimeStart = -1;
	let scheduledPickupTimeEnd = -1;
	let scheduledDropoffTimeStart = -1;
	let scheduledDropoffTimeEnd = -1;
	if (insertionCase.direction == InsertDirection.BUS_STOP_PICKUP) {
		scheduledPickupTimeStart =
			promisedTimes === undefined || !window.covers(promisedTimes.pickup)
				? window.startTime
				: promisedTimes.pickup;
		scheduledPickupTimeEnd = Math.min(
			window.endTime,
			SCHEDULED_TIME_BUFFER_PICKUP + scheduledPickupTimeStart
		);
		const prevIsSameEventGroup =
			prev &&
			prevLegDuration === 0 &&
			prev.time.noDistanceBetween(new Interval(scheduledPickupTimeStart, scheduledPickupTimeEnd));
		if (prevIsSameEventGroup) {
			scheduledPickupTimeStart = Math.max(scheduledPickupTimeStart, prev.scheduledTimeStart);
			scheduledPickupTimeEnd = Math.min(
				window.endTime,
				SCHEDULED_TIME_BUFFER_PICKUP + scheduledPickupTimeStart,
				prev.scheduledTimeEnd
			);
		}
		scheduledDropoffTimeStart = scheduledPickupTimeEnd + passengerDuration;
		scheduledDropoffTimeEnd = Math.min(
			scheduledDropoffTimeStart + getScheduledTimeBufferDropoff(passengerDuration),
			window.endTime + passengerDuration
		);
		const nextIsSameEventGroup =
			next &&
			nextLegDuration === 0 &&
			next.time.noDistanceBetween(new Interval(scheduledDropoffTimeStart, scheduledDropoffTimeEnd));
		if (nextIsSameEventGroup) {
			scheduledDropoffTimeStart = Math.max(scheduledDropoffTimeStart, next.scheduledTimeStart);
			scheduledDropoffTimeEnd = Math.min(
				scheduledDropoffTimeStart + getScheduledTimeBufferDropoff(passengerDuration),
				window.endTime + passengerDuration,
				next.scheduledTimeEnd
			);
		}
	} else {
		scheduledDropoffTimeEnd =
			promisedTimes === undefined || !window.covers(promisedTimes.dropoff)
				? window.endTime
				: promisedTimes.dropoff;
		scheduledDropoffTimeStart = Math.max(
			scheduledDropoffTimeEnd - getScheduledTimeBufferDropoff(passengerDuration),
			window.startTime
		);
		const nextIsSameEventGroup =
			next &&
			nextLegDuration === 0 &&
			next.time.noDistanceBetween(new Interval(scheduledDropoffTimeStart, scheduledDropoffTimeEnd));
		if (nextIsSameEventGroup) {
			scheduledDropoffTimeEnd = Math.min(scheduledDropoffTimeEnd, next.scheduledTimeEnd);
			scheduledDropoffTimeStart = Math.max(
				scheduledDropoffTimeEnd - getScheduledTimeBufferDropoff(passengerDuration),
				window.startTime,
				next.scheduledTimeStart
			);
		}
		scheduledPickupTimeEnd = scheduledDropoffTimeStart - passengerDuration;
		scheduledPickupTimeStart = Math.max(
			window.startTime - passengerDuration,
			scheduledPickupTimeEnd - SCHEDULED_TIME_BUFFER_PICKUP
		);
		const prevIsSameEventGroup =
			prev &&
			prevLegDuration === 0 &&
			prev.time.noDistanceBetween(new Interval(scheduledPickupTimeStart, scheduledPickupTimeEnd));
		if (prevIsSameEventGroup) {
			scheduledPickupTimeEnd = Math.min(scheduledPickupTimeEnd, prev.scheduledTimeEnd);
			scheduledPickupTimeStart = Math.max(
				window.startTime - passengerDuration,
				scheduledPickupTimeEnd - SCHEDULED_TIME_BUFFER_PICKUP,
				prev.scheduledTimeStart
			);
		}
	}
	return {
		scheduledPickupTimeStart,
		scheduledPickupTimeEnd,
		communicatedPickupTime: scheduledPickupTimeStart,
		scheduledDropoffTimeStart,
		scheduledDropoffTimeEnd,
		communicatedDropoffTime: scheduledDropoffTimeEnd
	};
}
