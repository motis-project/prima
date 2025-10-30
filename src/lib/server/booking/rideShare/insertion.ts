import {
	COST_PER_DRIVING_TIME,
	COST_PER_WAITING_TIME,
	PROFIT_PER_TIME,
	MIN_PREP,
	MINIMUM_PROFIT,
	SCHEDULED_TIME_BUFFER_PICKUP,
	BASE_PROFIT
} from '$lib/constants';
import { InsertHow, InsertWhat } from '$lib/util/booking/insertionTypes';
import { getScheduledEventTime } from '$lib/util/getScheduledEventTime';
import { getScheduledTimeBufferDropoff } from '$lib/util/getScheduledTimeBuffer';
import { Interval } from '$lib/util/interval';
import {
	InsertDirection,
	InsertWhere,
	printInsertionType,
	type InsertionType
} from '../insertionTypes';
import type { PromisedTimes } from '../taxi/PromisedTimes';
import type { RideShareEvent, RideShareTour } from './getRideShareTours';
import type { InsertionInfo } from './insertionTypes';
import { iterateAllInsertions } from './iterateAllInsertions';
import type { RoutingResults } from './routing';
import type { Range } from '$lib/util/booking/getPossibleInsertions';
import { MINUTE, roundToUnit } from '$lib/util/time';
import {
	getAllowedOperationTimes,
	getArrivalWindow,
	getNextLegDuration,
	getPrevLegDuration
} from './durations';
import type { PromisedTimesRideShare } from './PromisedTimesRideShare';

export type InsertionEvaluation = {
	pickupTime: number;
	dropoffTime: number;
	scheduledPickupTimeStart: number;
	scheduledPickupTimeEnd: number;
	scheduledDropoffTimeStart: number;
	scheduledDropoffTimeEnd: number;
	pickupCase: InsertionType;
	dropoffCase: InsertionType;
	waitingTime: number;
	pickupPrevLegDuration: number;
	pickupNextLegDuration: number;
	dropoffPrevLegDuration: number;
	dropoffNextLegDuration: number;
	profit: number;
};

export type Insertion = InsertionEvaluation & {
	pickupIdx: number;
	dropoffIdx: number;
	tour: number;
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
	drivingWaitingTime: number;
	approachPlusReturnDurationDelta: number;
	fullyPayedDurationDelta: number;
	prevId: number | undefined;
	nextId: number | undefined;
	idxInEvents: number;
	time: number;
};

type Evaluations = {
	busStopEvaluations: SingleInsertionEvaluation[][][][];
	userChosenEvaluations: SingleInsertionEvaluation[][];
	bothEvaluations: Insertion[][][];
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

export function toInsertionWithISOStrings(i: Insertion) {
	return {
		...i,
		pickupTime: new Date(i.pickupTime).toISOString(),
		dropoffTime: new Date(i.dropoffTime).toISOString(),
		scheduledPickupTimeStart: new Date(i.scheduledPickupTimeStart).toISOString(),
		scheduledPickupTimeEnd: new Date(i.scheduledPickupTimeEnd).toISOString(),
		scheduledDropoffTimeStart: new Date(i.scheduledDropoffTimeStart).toISOString(),
		scheduledDropoffTimeEnd: new Date(i.scheduledDropoffTimeEnd).toISOString()
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
	prev: RideShareEvent,
	next: RideShareEvent,
	promisedTimes?: PromisedTimesRideShare
): SingleInsertionEvaluation | undefined {
	console.assert(insertionCase.what != InsertWhat.BOTH);
	const events = insertionInfo.events;
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
		!keepsPromises(
			insertionCase,
			arrivalWindow,
			passengerDuration,
			insertionInfo.tourId,
			promisedTimes
		)
	) {
		console.log(
			'Promise not kept',
			printInsertionType(insertionCase),
			{ prev: prev.eventId },
			{ next: next.eventId }
		);
		return undefined;
	}
	const drivingDurationDelta = prevLegDuration + nextLegDuration - prev.nextLegDuration;
	console.assert(insertionCase.what != InsertWhat.BOTH);
	const communicatedTime = isPickup(insertionCase)
		? promisedTimes !== undefined && arrivalWindow.covers(promisedTimes.pickup)
			? promisedTimes.pickup
			: arrivalWindow.startTime
		: promisedTimes !== undefined && arrivalWindow.covers(promisedTimes.dropoff)
			? promisedTimes.dropoff
			: arrivalWindow.endTime;

	const scheduledTimeCandidate =
		communicatedTime +
		(isPickup(insertionCase)
			? Math.min(arrivalWindow.size(), SCHEDULED_TIME_BUFFER_PICKUP)
			: -Math.min(arrivalWindow.size(), getScheduledTimeBufferDropoff(passengerDuration)));
	let newEndTimePrev = undefined;
	if (prev.isPickup && communicatedTime - prev.scheduledTimeEnd - prevLegDuration < 0) {
		newEndTimePrev = communicatedTime - prevLegDuration;
	}
	let newStartTimeNext = undefined;
	if (!next.isPickup && communicatedTime - next.scheduledTimeEnd - nextLegDuration < 0) {
		newStartTimeNext = communicatedTime + nextLegDuration;
	}
	const prevShift = newEndTimePrev !== undefined ? getScheduledEventTime(prev) - newEndTimePrev : 0;
	const nextShift =
		newStartTimeNext !== undefined ? newStartTimeNext - getScheduledEventTime(next) : 0;
	const waitingTime = getWaitingTimeDelta(
		prev,
		next,
		events,
		prevShift,
		nextShift,
		drivingDurationDelta
	);

	const fullyPayedDurationDelta = drivingDurationDelta;
	const sie: SingleInsertionEvaluation = {
		window: arrivalWindow,
		prevLegDuration: prevLegDuration,
		nextLegDuration: nextLegDuration,
		case: structuredClone(insertionCase),
		fullyPayedDurationDelta,
		approachPlusReturnDurationDelta: 0,
		drivingWaitingTime: waitingTime,
		prevId: prev?.eventId,
		nextId: next?.eventId,
		time: scheduledTimeCandidate,
		idxInEvents: insertionInfo.idxInEvents
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
	prev: RideShareEvent,
	next: RideShareEvent,
	promisedTimes?: PromisedTimesRideShare
): InsertionEvaluation | undefined {
	console.assert(
		insertionCase.what == InsertWhat.BOTH,
		'Not inserting both in evaluateBothInsertion.'
	);
	const events = insertionInfo.events;
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
			{ prev: prev.eventId },
			{ next: next.eventId }
		);
		return undefined;
	}
	if (
		promisedTimes != undefined &&
		!keepsPromises(
			insertionCase,
			arrivalWindow,
			passengerDuration,
			insertionInfo.tourId,
			promisedTimes
		)
	) {
		console.log(
			'promise not kept',
			promisedTimes,
			printInsertionType(insertionCase),
			{ prev: prev.eventId },
			{ next: next.eventId }
		);
		return undefined;
	}

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
	if (prev.isPickup) {
		prevShift = Math.max(getScheduledEventTime(prev) - scheduledPickupTimeEnd + prevLegDuration, 0);
	}
	let nextShift = 0;
	if (!next.isPickup) {
		nextShift = Math.max(
			scheduledDropoffTimeStart + nextLegDuration - getScheduledEventTime(next),
			0
		);
	}

	const drivingDurationDelta =
		prevLegDuration + nextLegDuration + passengerDuration - prev.nextLegDuration;
	const waitingTime = getWaitingTimeDelta(
		prev,
		next,
		events,
		prevShift,
		nextShift,
		drivingDurationDelta
	);

	const profit = getProfit(passengerDuration, drivingDurationDelta, waitingTime);
	if (profit < MINIMUM_PROFIT) {
		console.log(
			promisedTimes === undefined ? 'WHITELIST' : 'BOOKING API',
			'insertion considered not feasible for driver,',
			printInsertionType(insertionCase),
			{ prevId: prev.eventId },
			{ nextId: next.eventId },
			{ waitingTime: waitingTime },
			{ payedDurationDelta: passengerDuration },
			{ drivingDurationDelta: drivingDurationDelta },
			{ drivingCost: drivingDurationDelta * COST_PER_DRIVING_TIME },
			{ income: passengerDuration * PROFIT_PER_TIME },
			{ waitingCost: waitingTime * COST_PER_WAITING_TIME },
			COST_PER_DRIVING_TIME,
			COST_PER_WAITING_TIME,
			PROFIT_PER_TIME,
			{ profit }
		);
		return undefined;
	}
	console.log(
		promisedTimes === undefined ? 'WHITELIST' : 'BOOKING API',
		'feasible insertion found,',
		printInsertionType(insertionCase),
		{ prevId: prev.eventId },
		{ nextId: next.eventId },
		{ waitingTime: waitingTime },
		{ payedDurationDelta: passengerDuration },
		{ drivingDurationDelta: drivingDurationDelta },
		{ profit }
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
		waitingTime,
		pickupPrevLegDuration: prevLegDuration,
		pickupNextLegDuration: passengerDuration,
		dropoffPrevLegDuration: passengerDuration,
		dropoffNextLegDuration: nextLegDuration,
		profit
	};
}

export function evaluateSingleInsertions(
	rideShareTours: RideShareTour[],
	startFixed: boolean,
	insertionRanges: Map<number, Range[]>,
	busStopTimes: Interval[][],
	routingResults: RoutingResults,
	travelDurations: (number | undefined)[],
	promisedTimes?: PromisedTimesRideShare
): Evaluations {
	const insertionIdxCount = rideShareTours.reduce(
		(acc, curr) =>
			(acc +=
				insertionRanges
					.get(curr.rideShareTour)
					?.reduce((acc, curr) => (acc += curr.latestDropoff + 1 - curr.earliestPickup), 0) ?? 0),
		0
	);
	const bothEvaluations: Insertion[][][] = [];
	const userChosenEvaluations: SingleInsertionEvaluation[][] = [];
	const busStopEvaluations: SingleInsertionEvaluation[][][][] = new Array<
		SingleInsertionEvaluation[][][]
	>(busStopTimes.length);
	for (let i = 0; i != insertionIdxCount + 1; i++) {
		userChosenEvaluations[i] = new Array<SingleInsertionEvaluation>();
	}
	for (let i = 0; i != busStopTimes.length; ++i) {
		busStopEvaluations[i] = new Array<SingleInsertionEvaluation[][]>(busStopTimes[i].length);
		bothEvaluations[i] = new Array<Insertion[]>(busStopTimes[i].length);
		for (let j = 0; j != busStopTimes[i].length; ++j) {
			busStopEvaluations[i][j] = new Array<SingleInsertionEvaluation[]>();
			bothEvaluations[i][j] = new Array<Insertion>();
			for (let k = 0; k != insertionIdxCount; ++k) {
				busStopEvaluations[i][j][k] = new Array<SingleInsertionEvaluation>();
			}
		}
	}
	const prepTime = Date.now() + MIN_PREP;
	const direction = startFixed ? InsertDirection.BUS_STOP_PICKUP : InsertDirection.BUS_STOP_DROPOFF;
	iterateAllInsertions(rideShareTours, insertionRanges, (insertionInfo: InsertionInfo) => {
		const events = insertionInfo.events;
		const prev: RideShareEvent = events[insertionInfo.idxInEvents - 1];
		const next: RideShareEvent = events[insertionInfo.idxInEvents];
		if (prev === undefined || next === undefined || prev.tourId !== next.tourId) {
			return;
		}
		const insertionCase = {
			how: InsertHow.INSERT,
			where: InsertWhere.BETWEEN_EVENTS,
			what: InsertWhat.BUS_STOP,
			direction
		};
		const windows = getAllowedOperationTimes(prev, next, prepTime);

		// Ensure shifting the previous or next events' scheduledTime does not cause the whole tour to be prolonged too much
		if (windows.length != 0) {
			const twoBefore = events[insertionInfo.idxInEvents - 2];
			if (twoBefore && twoBefore?.tourId != prev.tourId) {
				const tourDifference = prev.departure - twoBefore.arrival;
				const scheduledTimeLength = prev.scheduledTimeEnd - prev.scheduledTimeStart;
				windows.forEach((w) => {
					w.startTime += Math.max(0, scheduledTimeLength - tourDifference);
				});
			}
			const twoAfter = events[insertionInfo.idxInEvents + 1];
			if (twoAfter && twoAfter?.tourId != next.tourId && windows.length != 0) {
				const tourDifference = twoAfter.departure - next.arrival;
				const scheduledTimeLength = next.scheduledTimeEnd - next.scheduledTimeStart;
				windows.forEach((w) => {
					w.endTime -= Math.max(0, scheduledTimeLength - tourDifference);
				});
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
					promisedTimes
				);
				if (resultBoth != undefined) {
					bothEvaluations[busStopIdx][busTimeIdx].push({
						...resultBoth,
						tour: next.tourId,
						pickupIdx: insertionInfo.idxInEvents,
						dropoffIdx: insertionInfo.idxInEvents,
						prevPickupId: prev.eventId,
						nextPickupId: next.eventId,
						prevDropoffId: prev.eventId,
						nextDropoffId: next.eventId,
						pickupIdxInEvents: insertionInfo.idxInEvents,
						dropoffIdxInEvents: insertionInfo.idxInEvents
					});
				}

				insertionCase.what = InsertWhat.BUS_STOP;
				const resultBus = evaluateSingleInsertion(
					insertionCase,
					windows,
					busStopTimes[busStopIdx][busTimeIdx],
					routingResults,
					insertionInfo,
					busStopIdx,
					prev,
					next,
					promisedTimes
				);
				if (resultBus !== undefined) {
					busStopEvaluations[busStopIdx][busTimeIdx][insertionInfo.insertionIdx].push(resultBus);
				}
			}
		}
		insertionCase.what = InsertWhat.USER_CHOSEN;
		const resultUserChosen = evaluateSingleInsertion(
			insertionCase,
			windows,
			undefined,
			routingResults,
			insertionInfo,
			undefined,
			prev,
			next,
			promisedTimes
		);
		if (resultUserChosen != undefined) {
			userChosenEvaluations[insertionInfo.insertionIdx].push(resultUserChosen);
		}
	});
	return { busStopEvaluations, userChosenEvaluations, bothEvaluations };
}

export function evaluatePairInsertions(
	rideShareTours: RideShareTour[],
	startFixed: boolean,
	insertionRanges: Map<number, Range[]>,
	busStopTimes: Interval[][],
	busStopEvaluations: SingleInsertionEvaluation[][][][],
	userChosenEvaluations: SingleInsertionEvaluation[][],
	whitelist?: boolean
): Insertion[][][] {
	const bestEvaluations = new Array<Insertion[][]>(busStopTimes.length);
	for (let i = 0; i != busStopTimes.length; ++i) {
		bestEvaluations[i] = new Array<Insertion[]>(busStopTimes[i].length);
		for (let j = 0; j != busStopTimes[i].length; ++j) {
			bestEvaluations[i][j] = new Array<Insertion>();
		}
	}
	iterateAllInsertions(rideShareTours, insertionRanges, (insertionInfo: InsertionInfo) => {
		const events = insertionInfo.events;
		const pickupIdx = insertionInfo.idxInEvents;
		const prevPickup = events[pickupIdx - 1];
		const twoBeforePickup = events[pickupIdx - 2];
		const nextPickup = events[pickupIdx];
		for (
			let dropoffIdx = pickupIdx + 1;
			dropoffIdx != insertionInfo.currentRange.latestDropoff + 1;
			++dropoffIdx
		) {
			for (let busStopIdx = 0; busStopIdx != busStopTimes.length; ++busStopIdx) {
				for (let timeIdx = 0; timeIdx != busStopTimes[busStopIdx].length; ++timeIdx) {
					const pickupCases = startFixed
						? busStopEvaluations[busStopIdx][timeIdx][insertionInfo.insertionIdx]
						: userChosenEvaluations[insertionInfo.insertionIdx];
					if (pickupCases == undefined) {
						break;
					}
					const dropoffCases = startFixed
						? userChosenEvaluations[insertionInfo.insertionIdx + dropoffIdx - pickupIdx]
						: busStopEvaluations[busStopIdx][timeIdx][
								insertionInfo.insertionIdx + dropoffIdx - pickupIdx
							];
					if (dropoffCases == undefined) {
						continue;
					}
					const prevDropoff = events[dropoffIdx - 1];
					const nextDropoff = events[dropoffIdx];
					const twoAfterDropoff = events[dropoffIdx + 1];
					for (const pickup of pickupCases) {
						for (const dropoff of dropoffCases) {
							const communicatedPickupTime = Math.max(
								pickup.window.endTime - SCHEDULED_TIME_BUFFER_PICKUP,
								pickup.window.startTime
							);
							const communicatedDropoffTime = Math.min(
								Math.max(
									dropoff.window.startTime,
									communicatedPickupTime + pickup.nextLegDuration + dropoff.prevLegDuration
								) + getScheduledTimeBufferDropoff(dropoff.window.startTime - pickup.window.endTime),
								dropoff.window.endTime
							);

							// Verify, that the shift induced to other events by pickup and dropoff are mutually compatible
							const availableDistance =
								communicatedDropoffTime -
								communicatedPickupTime -
								dropoff.prevLegDuration -
								pickup.nextLegDuration;
							if (availableDistance < 0) {
								continue;
							}

							// Determine the scheduled times for pickup and dropoff
							const leewayBetweenPickupDropoff =
								communicatedDropoffTime -
								communicatedPickupTime -
								pickup.nextLegDuration -
								dropoff.prevLegDuration;
							const pickupScheduledShift = Math.min(
								pickup.window.size(),
								SCHEDULED_TIME_BUFFER_PICKUP,
								leewayBetweenPickupDropoff
							);
							const scheduledPickupTime = communicatedPickupTime + pickupScheduledShift;
							const scheduledDropoffTime =
								communicatedDropoffTime -
								Math.min(
									dropoff.window.size(),
									getScheduledTimeBufferDropoff(dropoff.window.startTime - pickup.window.endTime),
									leewayBetweenPickupDropoff - pickupScheduledShift
								);

							// Compute the delta of the taxi's time spend driving for the tour containing the new request
							const approachPlusReturnDurationDelta =
								pickup.approachPlusReturnDurationDelta + dropoff.approachPlusReturnDurationDelta;
							const fullyPayedDurationDelta =
								pickup.fullyPayedDurationDelta + dropoff.fullyPayedDurationDelta;

							// Compute the delta of the taxi's waiting time
							const newDeparture =
								prevPickup.tourId !== twoBeforePickup?.tourId
									? Math.min(
											communicatedPickupTime - pickup.prevLegDuration,
											getScheduledEventTime(prevPickup)
										) - prevPickup.prevLegDuration
									: prevPickup.departure;
							const newArrival =
								nextDropoff.tourId !== twoAfterDropoff?.tourId
									? Math.max(
											communicatedDropoffTime + dropoff.nextLegDuration,
											getScheduledEventTime(nextDropoff)
										) + nextDropoff.nextLegDuration
									: nextDropoff.arrival;
							const relevantEvents = events.slice(pickupIdx, dropoffIdx);
							const tours = new Set<number>();
							let oldTourDurationSum = 0;
							relevantEvents.forEach((e) => {
								if (!tours.has(e.tourId)) {
									oldTourDurationSum += e.arrival - e.departure;
									tours.add(e.tourId);
								}
							});
							const tourDurationDelta = newArrival - newDeparture - oldTourDurationSum;
							const waitingTime =
								tourDurationDelta - approachPlusReturnDurationDelta - fullyPayedDurationDelta;

							const payedDurationDelta = scheduledDropoffTime - scheduledPickupTime;

							const profit = getProfit(
								payedDurationDelta,
								tourDurationDelta - waitingTime,
								waitingTime
							);
							if (profit < MINIMUM_PROFIT) {
								console.log(
									'insertion considered not feasible for driver,',
									'pickup: ',
									printInsertionType(pickup.case),
									'dropoff: ',
									printInsertionType(dropoff.case),
									{ prevPickupId: prevPickup.eventId },
									{ nextPickupId: nextPickup.eventId },
									{ prevDropoffId: prevDropoff.eventId },
									{ nextDropoffId: nextDropoff.eventId },
									{ waitingTime },
									{ payedDurationDelta },
									{ profit }
								);
								return undefined;
							}
							console.log(
								whitelist ? 'WHITELIST' : 'BOOKING API',
								'feasible insertion found,',
								'pickup: ',
								printInsertionType(pickup.case),
								'dropoff: ',
								printInsertionType(dropoff.case),
								{ prevPickupId: prevPickup.eventId },
								{ nextPickupId: nextPickup.eventId },
								{ prevDropoffId: prevDropoff.eventId },
								{ nextDropoffId: nextDropoff.eventId },
								{ waitingTime },
								{ profit }
							);
							if (bestEvaluations[busStopIdx][timeIdx] == undefined) {
								const tour = events[pickupIdx].tourId;
								bestEvaluations[busStopIdx][timeIdx].push({
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
									waitingTime,
									tour,
									pickupPrevLegDuration: pickup.prevLegDuration,
									pickupNextLegDuration: pickup.nextLegDuration,
									dropoffPrevLegDuration: dropoff.prevLegDuration,
									dropoffNextLegDuration: dropoff.nextLegDuration,
									prevPickupId: pickup.prevId,
									nextPickupId: pickup.nextId,
									prevDropoffId: dropoff.prevId,
									nextDropoffId: dropoff.nextId,
									pickupIdxInEvents: pickup.idxInEvents,
									dropoffIdxInEvents: dropoff.idxInEvents,
									profit
								});
							}
						}
					}
				}
			}
		}
	});
	return bestEvaluations;
}

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
	tourId: number,
	promisedTimes: PromisedTimesRideShare
): boolean => {
	if (tourId !== promisedTimes.tourId) {
		console.log('PROMISE CHECK: DROPOFF WINDOW FAILED', {
			tourId,
			promisedTourId: promisedTimes.tourId
		});
		return false;
	}
	const shift = insertionCase.what === InsertWhat.BOTH ? directDuration : 0;
	const w = arrivalWindow.shift(
		insertionCase.direction == InsertDirection.BUS_STOP_PICKUP ? shift : -shift
	);
	const pickupWindow = expandToFullMinutes(
		insertionCase.direction == InsertDirection.BUS_STOP_PICKUP
			? arrivalWindow
			: w.shift(-SCHEDULED_TIME_BUFFER_PICKUP)
	);

	const dropoffWindow = expandToFullMinutes(
		insertionCase.direction == InsertDirection.BUS_STOP_DROPOFF
			? arrivalWindow
			: w.shift(getScheduledTimeBufferDropoff(directDuration))
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

function getWaitingTimeDelta(
	prev: RideShareEvent,
	next: RideShareEvent,
	events: RideShareEvent[],
	prevShift: number,
	nextShift: number,
	dirvingDurationDelta: number
) {
	let delta = 0;
	const twoBefore =
		prev === undefined
			? undefined
			: events[events.findIndex((e) => e.eventId === prev.eventId) - 1];
	const twoAfter =
		next === undefined
			? undefined
			: events[events.findIndex((e) => e.eventId === next.eventId) + 1];
	if (prevShift && twoBefore?.tourId !== prev.tourId) {
		delta += prevShift;
	}
	if (nextShift && twoAfter?.tourId !== next.tourId) {
		delta += nextShift;
	}
	const tourDurationDelta = delta;
	return tourDurationDelta - dirvingDurationDelta;
}

function getTimestamps(
	insertionCase: InsertionType,
	window: Interval,
	promisedTimes: PromisedTimes | undefined,
	prev: RideShareEvent,
	next: RideShareEvent,
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
	const prevIsSameEventGroup =
		prev &&
		prevLegDuration === 0 &&
		prev.time.overlaps(window) &&
		(!promisedTimes ||
			expandToFullMinutes(prev.time).overlaps(
				new Interval(promisedTimes.pickup, promisedTimes.pickup + SCHEDULED_TIME_BUFFER_PICKUP)
			));

	const nextIsSameEventGroup =
		next &&
		nextLegDuration === 0 &&
		next.time.overlaps(window) &&
		(!promisedTimes ||
			expandToFullMinutes(next.time).overlaps(
				new Interval(
					promisedTimes.dropoff,
					promisedTimes.dropoff + getScheduledTimeBufferDropoff(passengerDuration)
				)
			));
	if (prevIsSameEventGroup) {
		const scheduledPickupTimeStart =
			promisedTimes === undefined || !window.covers(promisedTimes.pickup)
				? window.startTime
				: promisedTimes.pickup;
		const scheduledPickupTimeEnd = Math.min(
			window.endTime,
			SCHEDULED_TIME_BUFFER_PICKUP + scheduledPickupTimeStart
		);
		const scheduledDropoffTimeStart = scheduledPickupTimeEnd + passengerDuration;
		const scheduledDropoffTimeEnd = Math.min(
			scheduledDropoffTimeStart + getScheduledTimeBufferDropoff(passengerDuration),
			window.endTime + passengerDuration
		);
		return {
			scheduledPickupTimeStart,
			scheduledPickupTimeEnd,
			communicatedPickupTime: scheduledPickupTimeStart,
			scheduledDropoffTimeStart,
			scheduledDropoffTimeEnd,
			communicatedDropoffTime: scheduledDropoffTimeEnd
		};
	}
	if (nextIsSameEventGroup) {
		const scheduledDropoffTimeEnd = Math.min(
			next.scheduledTimeStart,
			promisedTimes?.dropoff ?? Number.MAX_VALUE,
			window.endTime
		);
		const scheduledDropoffTimeStart = scheduledDropoffTimeEnd;
		const scheduledPickupTimeEnd = scheduledDropoffTimeStart - passengerDuration;
		const scheduledPickupTimeStart = scheduledPickupTimeEnd;
		return {
			scheduledPickupTimeStart,
			scheduledPickupTimeEnd,
			communicatedPickupTime: scheduledPickupTimeStart,
			scheduledDropoffTimeStart,
			scheduledDropoffTimeEnd,
			communicatedDropoffTime: scheduledDropoffTimeEnd
		};
	}
	if (insertionCase.direction == InsertDirection.BUS_STOP_PICKUP) {
		const scheduledPickupTimeStart =
			promisedTimes === undefined || !window.covers(promisedTimes.pickup)
				? window.startTime
				: promisedTimes.pickup;
		const scheduledPickupTimeEnd = Math.min(
			window.endTime,
			SCHEDULED_TIME_BUFFER_PICKUP + scheduledPickupTimeStart
		);
		const scheduledDropoffTimeStart = scheduledPickupTimeEnd + passengerDuration;
		const scheduledDropoffTimeEnd = Math.min(
			scheduledDropoffTimeStart + getScheduledTimeBufferDropoff(passengerDuration),
			window.endTime + passengerDuration
		);
		return {
			scheduledPickupTimeStart,
			scheduledPickupTimeEnd,
			communicatedPickupTime: scheduledPickupTimeStart,
			scheduledDropoffTimeStart,
			scheduledDropoffTimeEnd,
			communicatedDropoffTime: scheduledDropoffTimeEnd
		};
	} else {
		const scheduledDropoffTimeEnd =
			promisedTimes === undefined || !window.covers(promisedTimes.dropoff)
				? window.endTime
				: promisedTimes.dropoff;
		const scheduledDropoffTimeStart = Math.max(
			scheduledDropoffTimeEnd - getScheduledTimeBufferDropoff(passengerDuration),
			window.startTime
		);
		const scheduledPickupTimeEnd = scheduledDropoffTimeStart - passengerDuration;
		const scheduledPickupTimeStart = Math.max(
			window.startTime - passengerDuration,
			scheduledPickupTimeEnd - SCHEDULED_TIME_BUFFER_PICKUP
		);
		return {
			scheduledPickupTimeStart,
			scheduledPickupTimeEnd,
			communicatedPickupTime: scheduledPickupTimeStart,
			scheduledDropoffTimeStart,
			scheduledDropoffTimeEnd,
			communicatedDropoffTime: scheduledDropoffTimeEnd
		};
	}
}

function getProfit(payedDuration: number, unpayedDrivingDuration: number, waitingTime: number) {
	return (
		BASE_PROFIT +
		PROFIT_PER_TIME * payedDuration -
		COST_PER_DRIVING_TIME * unpayedDrivingDuration -
		COST_PER_WAITING_TIME * waitingTime
	);
}
