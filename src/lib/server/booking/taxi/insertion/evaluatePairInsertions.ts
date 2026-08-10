import { SCHEDULED_TIME_BUFFER_PICKUP } from '$lib/constants';
import type { Capacities } from '$lib/util/booking/Capacities';
import type { Range } from '$lib/util/booking/getPossibleInsertions';
import { InsertHow } from '$lib/util/booking/insertionTypes';
import { getScheduledTimeBufferDropoff } from '$lib/util/getScheduledTimeBuffer';
import { getScheduledEventTime } from '$lib/util/getScheduledEventTime';
import type { Interval } from '$lib/util/interval';
import type { InsertionInfo } from '../../insertionTypes';
import { printInsertionType } from '../../insertionTypes';
import { comesFromCompany, returnsToCompany } from '../durations';
import type { Company, Event } from '../getBookingAvailability';
import type { Insertion, SingleInsertionEvaluation, SingleInsertionEvaluations } from './core';
import { computeCost, getWeightedPassengerDurationDelta, waitsTooLong } from './insertionMetrics';
import { iterateAllInsertions } from './iterateAllInsertions';

type PairInsertionSchedule = {
	communicatedPickupTime: number;
	scheduledPickupTime: number;
	scheduledDropoffTime: number;
	communicatedDropoffTime: number;
};

type PairInsertionMetrics = {
	taxiWaitingTime: number;
	approachPlusReturnDurationDelta: number;
	fullyPayedDurationDelta: number;
	weightedPassengerDuration: number;
	cost: number;
	departure: number | undefined;
	arrival: number | undefined;
};

type PairInsertionMetricsInput = {
	events: Event[];
	pickupIdx: number;
	dropoffIdx: number;
	pickup: SingleInsertionEvaluation;
	dropoff: SingleInsertionEvaluation;
	schedule: PairInsertionSchedule;
	cumulatedTaxiDrivingDelta: number;
	passengerCount: number;
};

export function evaluatePairInsertions(
	companies: Company[],
	startFixed: boolean,
	insertionRanges: Map<number, Range[]>,
	busStopTimes: Interval[][],
	singleEvaluations: SingleInsertionEvaluations,
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
		let intermediatePassengerDrivingDuration = 0;
		for (
			let dropoffIdx = pickupIdx + 1;
			dropoffIdx != insertionInfo.currentRange.latestDropoff + 1;
			++dropoffIdx
		) {
			const prevDropoffIdx = dropoffIdx - 1;
			if (prevDropoffIdx !== pickupIdx) {
				const earlierEvent = events[prevDropoffIdx - 1];
				const laterEvent = events[prevDropoffIdx];
				const drivingDuration =
					earlierEvent.tourId === laterEvent.tourId
						? laterEvent.prevLegDuration
						: laterEvent.directDuration;
				if (drivingDuration == null) {
					return;
				}
				intermediatePassengerDrivingDuration += drivingDuration;
			}
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
				for (let timeIdx = 0; timeIdx != busStopTimes[busStopIdx].length; ++timeIdx) {
					const pickupCases = startFixed
						? singleEvaluations.getBusStop(busStopIdx, timeIdx, insertionInfo.insertionIdx)
						: singleEvaluations.getUserChosen(insertionInfo.insertionIdx);
					if (pickupCases.length === 0) {
						continue;
					}

					const dropoffCases = startFixed
						? singleEvaluations.getUserChosen(insertionInfo.insertionIdx + dropoffIdx - pickupIdx)
						: singleEvaluations.getBusStop(
								busStopIdx,
								timeIdx,
								insertionInfo.insertionIdx + dropoffIdx - pickupIdx
							);
					if (dropoffCases.length === 0) {
						continue;
					}
					const prevDropoff = events[dropoffIdx - 1];
					const nextDropoff = events[dropoffIdx];
					for (const pickup of pickupCases) {
						for (const dropoff of dropoffCases) {
							const passengerRouteDuration = getPassengerRouteDuration(
								pickup,
								dropoff,
								intermediatePassengerDrivingDuration
							);
							const schedule = schedulePairInsertion(pickup, dropoff, passengerRouteDuration);
							if (schedule === undefined) {
								continue;
							}
							const {
								communicatedPickupTime,
								scheduledPickupTime,
								scheduledDropoffTime,
								communicatedDropoffTime
							} = schedule;
							const metrics = getPairInsertionMetrics({
								events,
								pickupIdx,
								dropoffIdx,
								pickup,
								dropoff,
								schedule,
								cumulatedTaxiDrivingDelta,
								passengerCount: required.passengers
							});
							if (metrics === undefined) {
								continue;
							}
							const {
								taxiWaitingTime,
								approachPlusReturnDurationDelta,
								fullyPayedDurationDelta,
								weightedPassengerDuration,
								cost,
								departure,
								arrival
							} = metrics;

							console.log(
								whitelist ? 'WHITELIST' : 'BOOKING API',
								'valid insertion found,',
								'pickup: ',
								printInsertionType(pickup.insertionType),
								'dropoff: ',
								printInsertionType(dropoff.insertionType),
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
									pickupCase: structuredClone(pickup.insertionType),
									dropoffCase: structuredClone(dropoff.insertionType),
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
									departure,
									arrival,
									pickupPrevLegDuration: pickup.prevLegDuration,
									pickupNextLegDuration: pickup.nextLegDuration,
									dropoffPrevLegDuration: dropoff.prevLegDuration,
									dropoffNextLegDuration: dropoff.nextLegDuration,
									prevPickupId: pickup.previousEventId,
									nextPickupId: pickup.nextEventId,
									prevDropoffId: dropoff.previousEventId,
									nextDropoffId: dropoff.nextEventId,
									pickupIdxInEvents: pickup.eventInsertionIndex,
									dropoffIdxInEvents: dropoff.eventInsertionIndex
								};
							}
						}
					}
				}
			}
		}
	});
	return bestEvaluations;
}

function getPairInsertionMetrics({
	events,
	pickupIdx,
	dropoffIdx,
	pickup,
	dropoff,
	schedule,
	cumulatedTaxiDrivingDelta,
	passengerCount
}: PairInsertionMetricsInput): PairInsertionMetrics | undefined {
	const prevPickup = events[pickupIdx - 1];
	const twoBeforePickup = events[pickupIdx - 2];
	const nextPickup = events[pickupIdx];
	const prevDropoff = events[dropoffIdx - 1];
	const nextDropoff = events[dropoffIdx];
	const twoAfterDropoff = events[dropoffIdx + 1];
	const {
		communicatedPickupTime,
		scheduledPickupTime,
		scheduledDropoffTime,
		communicatedDropoffTime
	} = schedule;

	const approachPlusReturnDurationDelta =
		pickup.approachPlusReturnDurationDelta + dropoff.approachPlusReturnDurationDelta;
	const fullyPayedDurationDelta =
		pickup.fullyPayedDurationDelta + dropoff.fullyPayedDurationDelta + cumulatedTaxiDrivingDelta;

	const newDeparture = comesFromCompany(pickup.insertionType)
		? scheduledPickupTime - pickup.prevLegDuration
		: prevPickup.tourId !== twoBeforePickup?.tourId
			? Math.min(
					communicatedPickupTime - pickup.prevLegDuration,
					getScheduledEventTime(prevPickup)
				) - prevPickup.prevLegDuration
			: prevPickup.departure;
	const newArrival = returnsToCompany(dropoff.insertionType)
		? scheduledDropoffTime + dropoff.nextLegDuration
		: nextDropoff.tourId !== twoAfterDropoff?.tourId
			? Math.max(
					communicatedDropoffTime + dropoff.nextLegDuration,
					getScheduledEventTime(nextDropoff)
				) + nextDropoff.nextLegDuration
			: nextDropoff.arrival;

	const relevantEvents = events.slice(
		pickup.insertionType.how === InsertHow.CONNECT ? pickupIdx - 1 : pickupIdx,
		dropoff.insertionType.how === InsertHow.CONNECT ? dropoffIdx + 1 : dropoffIdx
	);
	const tours = new Set<number>();
	let oldTourDurationSum = 0;
	for (const event of relevantEvents) {
		if (!tours.has(event.tourId)) {
			oldTourDurationSum += event.arrival - event.departure;
			tours.add(event.tourId);
		}
	}
	const tourDurationDelta = newArrival - newDeparture - oldTourDurationSum;
	const taxiWaitingTime =
		tourDurationDelta - approachPlusReturnDurationDelta - fullyPayedDurationDelta;
	if (waitsTooLong(taxiWaitingTime)) {
		return undefined;
	}

	const prevShiftPickup =
		!comesFromCompany(pickup.insertionType) && prevPickup.isPickup
			? Math.max(
					0,
					getScheduledEventTime(prevPickup) - communicatedPickupTime + pickup.prevLegDuration
				)
			: 0;
	const nextShiftPickup =
		!returnsToCompany(pickup.insertionType) && !nextPickup.isPickup
			? Math.max(
					0,
					scheduledPickupTime + pickup.nextLegDuration - getScheduledEventTime(nextPickup)
				)
			: 0;
	const prevShiftDropoff =
		!comesFromCompany(dropoff.insertionType) && prevDropoff.isPickup
			? Math.max(
					0,
					getScheduledEventTime(prevDropoff) - scheduledDropoffTime + dropoff.prevLegDuration
				)
			: 0;
	const nextShiftDropoff =
		!returnsToCompany(dropoff.insertionType) && !nextDropoff.isPickup
			? Math.max(
					0,
					communicatedDropoffTime + dropoff.nextLegDuration - getScheduledEventTime(nextDropoff)
				)
			: 0;

	let weightedPassengerDuration = passengerCount * (scheduledDropoffTime - scheduledPickupTime);
	weightedPassengerDuration += getWeightedPassengerDurationDelta(
		pickup.insertionType,
		prevPickup,
		nextPickup,
		prevShiftPickup,
		nextShiftPickup
	);
	weightedPassengerDuration += getWeightedPassengerDurationDelta(
		dropoff.insertionType,
		prevDropoff,
		nextDropoff,
		prevShiftDropoff,
		nextShiftDropoff
	);

	return {
		taxiWaitingTime,
		approachPlusReturnDurationDelta,
		fullyPayedDurationDelta,
		weightedPassengerDuration,
		cost: computeCost(
			weightedPassengerDuration,
			approachPlusReturnDurationDelta,
			fullyPayedDurationDelta,
			taxiWaitingTime
		),
		departure: comesFromCompany(pickup.insertionType)
			? new Date(scheduledPickupTime - pickup.prevLegDuration).getTime()
			: undefined,
		arrival: returnsToCompany(dropoff.insertionType)
			? new Date(scheduledDropoffTime + dropoff.nextLegDuration).getTime()
			: undefined
	};
}

function schedulePairInsertion(
	pickup: SingleInsertionEvaluation,
	dropoff: SingleInsertionEvaluation,
	passengerRouteDuration: number
): PairInsertionSchedule | undefined {
	const communicatedPickupTime = Math.max(
		pickup.arrivalWindow.endTime - SCHEDULED_TIME_BUFFER_PICKUP,
		pickup.arrivalWindow.startTime
	);
	const earliestScheduledDropoffTime = Math.max(
		dropoff.arrivalWindow.startTime,
		communicatedPickupTime + passengerRouteDuration
	);

	const availablePickupBuffer =
		earliestScheduledDropoffTime - communicatedPickupTime - passengerRouteDuration;
	const pickupScheduledShift = Math.min(
		pickup.arrivalWindow.size(),
		SCHEDULED_TIME_BUFFER_PICKUP,
		availablePickupBuffer
	);
	const scheduledPickupTime =
		communicatedPickupTime +
		(pickup.insertionType.how === InsertHow.APPEND ? 0 : pickupScheduledShift);
	const scheduledDropoffTime = Math.max(
		dropoff.arrivalWindow.startTime,
		scheduledPickupTime + passengerRouteDuration
	);
	if (scheduledDropoffTime > dropoff.arrivalWindow.endTime) {
		return undefined;
	}
	const actualPassengerDuration = scheduledDropoffTime - scheduledPickupTime;
	const dropoffScheduledBuffer =
		dropoff.insertionType.how === InsertHow.PREPEND
			? 0
			: Math.min(
					dropoff.arrivalWindow.endTime - scheduledDropoffTime,
					getScheduledTimeBufferDropoff(actualPassengerDuration)
				);
	const communicatedDropoffTime = scheduledDropoffTime + dropoffScheduledBuffer;

	return {
		communicatedPickupTime,
		scheduledPickupTime,
		scheduledDropoffTime,
		communicatedDropoffTime
	};
}

function getPassengerRouteDuration(
	pickup: SingleInsertionEvaluation,
	dropoff: SingleInsertionEvaluation,
	intermediateDrivingDuration: number
): number {
	return pickup.nextLegDuration + intermediateDrivingDuration + dropoff.prevLegDuration;
}
