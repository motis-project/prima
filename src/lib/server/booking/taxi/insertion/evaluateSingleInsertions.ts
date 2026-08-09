import { MIN_PREP, MIN_PREP_BOOKING } from '$lib/constants';
import type { Capacities } from '$lib/util/booking/Capacities';
import type { Range } from '$lib/util/booking/getPossibleInsertions';
import { InsertHow, InsertWhat } from '$lib/util/booking/insertionTypes';
import type { Interval } from '$lib/util/interval';
import {
	INSERT_HOW_OPTIONS,
	InsertDirection,
	InsertWhere,
	canCaseBeValid,
	isCaseValid,
	type InsertionInfo
} from '../../insertionTypes';
import { getAllowedOperationTimes } from '../durations';
import type { Company, Event } from '../getBookingAvailability';
import {
	SingleInsertionEvaluations,
	evaluateBothInsertion,
	evaluateSingleInsertion,
	type Evaluations,
	type Insertion
} from './core';
import { waitsTooLong } from './insertionMetrics';
import { iterateAllInsertions } from './iterateAllInsertions';
import type { PromisedTimes } from '../PromisedTimes';
import type { RoutingResults } from '../routing';

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
	const insertionIdxCount = companies.reduce(
		(acc, curr) =>
			(acc += curr.vehicles.reduce(
				(acc, curr) =>
					(acc +=
						insertionRanges
							.get(curr.id)
							?.reduce((acc, curr) => (acc += curr.latestDropoff + 1 - curr.earliestPickup), 0) ??
						0),
				0
			)),
		0
	);
	const bothEvaluations: (Insertion | undefined)[][] = [];
	const singleEvaluations = new SingleInsertionEvaluations(busStopTimes, insertionIdxCount + 1);
	for (let i = 0; i != busStopTimes.length; ++i) {
		bothEvaluations[i] = new Array<Insertion | undefined>(busStopTimes[i].length);
	}
	const prepTime = Date.now() + (promisedTimes === undefined ? MIN_PREP : MIN_PREP_BOOKING);
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
				insertionInfo.vehicle,
				allowedTimes
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
					if (resultBus != undefined) {
						singleEvaluations.addBusStop(
							busStopIdx,
							busTimeIdx,
							insertionInfo.insertionIdx,
							resultBus
						);
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
			if (resultUserChosen != undefined) {
				singleEvaluations.addUserChosen(insertionInfo.insertionIdx, resultUserChosen);
			}
		});
	});
	return { singleEvaluations, bothEvaluations };
}
