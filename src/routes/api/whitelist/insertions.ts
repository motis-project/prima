import type { Company, Event } from '$lib/compositionTypes';
import { Interval } from '$lib/interval';
import { ITERATE_INSERTIONS_MODE, iterateAllInsertions } from './utils';
import { type RoutingResults } from './routing';
import type { Range } from './capacitySimulation';
import { hoursToMs, minutesToMs } from '$lib/time_utils';
import {
	MIN_PREP_MINUTES,
	PASSENGER_CHANGE_TIME,
	PASSENGER_TIME_COST_FACTOR,
	TAXI_DRIVING_TIME_COST_FACTOR,
	TAXI_WAITING_TIME_COST_FACTOR
} from '$lib/constants';
import type { InsertionInfo } from './insertionTypes';

export enum InsertionType {
	CONNECT,
	APPEND,
	PREPEND,
	INSERT
}

export enum ToInsert {
	PICKUP,
	DROPOFF,
	BOTH
}

const cases = [
	InsertionType.CONNECT,
	InsertionType.APPEND,
	InsertionType.PREPEND,
	InsertionType.INSERT
];

type Cost = {
	taxiWaitingTime: number;
	taxiDrivingDuration: number;
	passengerDuration: number;
	total: number;
};

type TimeCost = {
	time: Date;
	cost: Cost;
	approachDuration: number;
	returnDuration: number;
};

type Insertion = {
	userChosen: TimeCost | undefined;
	busStops: TimeCost[][];
	both: TimeCost[][];
	company: number;
	vehicle: number;
	tour1: number | undefined;
	tour2: number | undefined;
	event1: number | undefined;
	event2: number | undefined;
};

export type InsertionDurations = {
	approach: number;
	return: number;
	pickupToDropoff: number;
	fromPrev: number;
	toNext: number;
	fullWindow: number;
};

export function costFn(
	taxiDrivingDuration: number,
	taxiWaitingTime: number,
	passengerDuration: number
) {
	return (
		TAXI_DRIVING_TIME_COST_FACTOR * taxiDrivingDuration +
		PASSENGER_TIME_COST_FACTOR * passengerDuration +
		TAXI_WAITING_TIME_COST_FACTOR * taxiWaitingTime
	);
}

export function evaluateInsertion(
	type: InsertionType,
	window: Interval,
	durations: InsertionDurations,
	toInsert: ToInsert,
	currentBest: TimeCost | undefined,
	busStopWindow: Interval | undefined,
	startFixed: boolean
): TimeCost | undefined {
	const fullDuration = durations.approach + durations.return + durations.pickupToDropoff;
	console.log('window', window);
	console.log(fullDuration);
	console.log(window.getDurationMs());
	let arrivalWindow =
		window.getDurationMs() < fullDuration
			? undefined
			: window.shrink(durations.approach, durations.return);
	if (arrivalWindow == undefined) {
		return undefined;
	}
	if (busStopWindow != undefined) {
		arrivalWindow = arrivalWindow?.intersect(busStopWindow);
	}
	if (arrivalWindow == undefined) {
		return undefined;
	}
	const cost = computeCosts(type, durations, toInsert);
	if (currentBest != undefined && currentBest.cost.total <= cost.total) {
		return undefined;
	}
	return {
		time: startFixed ? arrivalWindow.startTime : arrivalWindow.endTime,
		cost,
		approachDuration: durations.approach,
		returnDuration: durations.return
	};
}

export function computeCosts(
	type: InsertionType,
	durations: InsertionDurations,
	toInsert: ToInsert
): Cost {
	const taxiDrivingDuration =
		durations.approach +
		durations.return +
		(toInsert == ToInsert.BOTH ? durations.pickupToDropoff : 0);
	const taxiDrivingDurationRelative =
		taxiDrivingDuration -
		(function () {
			switch (type) {
				case InsertionType.APPEND:
					return durations.fromPrev;
				case InsertionType.PREPEND:
					return durations.toNext;
				case InsertionType.CONNECT:
					return durations.toNext + durations.fromPrev;
				case InsertionType.INSERT:
					return durations.toNext + durations.fromPrev;
			}
		})();
	const taxiWaitingTime =
		type == InsertionType.CONNECT || type == InsertionType.INSERT
			? durations.fullWindow - taxiDrivingDuration - PASSENGER_CHANGE_TIME - toInsert ==
				ToInsert.BOTH
				? PASSENGER_CHANGE_TIME
				: 0
			: 0;
	const passengerDuration = (function () {
		switch (toInsert) {
			case ToInsert.PICKUP:
				return durations.return;
			case ToInsert.DROPOFF:
				return durations.approach;
			case ToInsert.BOTH:
				return durations.pickupToDropoff;
		}
	})();
	const total = costFn(taxiDrivingDuration, taxiWaitingTime, passengerDuration);
	return {
		taxiDrivingDuration: taxiDrivingDurationRelative,
		taxiWaitingTime,
		passengerDuration,
		total
	};
}

export function getBestTime(
	approachDuration: number,
	returnDuration: number,
	window: Interval,
	busStopTime: Interval,
	startFixed: boolean
): Date | undefined {
	let arrivalWindow =
		window.getDurationMs() < approachDuration + returnDuration
			? undefined
			: window.shrink(approachDuration, returnDuration);
	arrivalWindow = arrivalWindow?.intersect(busStopTime);
	return startFixed ? arrivalWindow?.startTime : arrivalWindow?.endTime;
}

export function computeTravelDurations(
	companies: Company[],
	possibleInsertionsByVehicle: Map<number, Range[]>,
	routingResults: RoutingResults,
	travelDurations: number[],
	startFixed: boolean,
	busStopTimes: Interval[][],
	busStopCompanyFilter: boolean[][]
): Insertion[] {
	let insertionCount = 0;
	[...possibleInsertionsByVehicle].forEach(([v, ranges]) => {
		ranges.forEach((range) => {
			insertionCount += range.latestDropoff + 1 - range.earliestPickup;
		});
	});
	const allInsertions = new Array<Insertion>(insertionCount);
	const insertionFn = (
		busStopIdx: number | undefined,
		insertionInfo: InsertionInfo,
		_: number | undefined
	) => {
		const prev: Event | undefined =
			insertionInfo.insertionIdx == 0
				? undefined
				: insertionInfo.vehicle.events[insertionInfo.insertionIdx - 1];
		const next: Event | undefined =
			insertionInfo.insertionIdx == insertionInfo.vehicle.events.length
				? undefined
				: insertionInfo.vehicle.events[insertionInfo.insertionIdx];
		cases.forEach((type) => {
			if (prev == undefined && type != InsertionType.PREPEND) {
				return;
			}
			if (next == undefined && type != InsertionType.APPEND) {
				return;
			}
			if (
				prev != undefined &&
				next != undefined &&
				(prev.tourId == next.tourId) != (type == InsertionType.INSERT)
			) {
				return;
			}
			const returnsToCompany = type === InsertionType.CONNECT || type === InsertionType.APPEND;
			const comesFromCompany = type === InsertionType.CONNECT || type === InsertionType.PREPEND;

			const prevTime =
				prev == undefined ? new Date(0) : comesFromCompany ? prev.arrival : prev.communicated;
			if (prevTime < new Date(Date.now() + minutesToMs(MIN_PREP_MINUTES))) {
				return;
			}
			if (allInsertions[insertionInfo.insertionIdx] == undefined) {
				const busStops = new Array<TimeCost[]>(busStopTimes.length);
				const both = new Array<TimeCost[]>(busStopTimes.length);
				for (let i = 0; i != busStops.length; ++i) {
					busStops[i] = new Array<TimeCost>(busStopTimes[i].length);
					both[i] = new Array<TimeCost>(busStopTimes[i].length);
				}
				allInsertions[insertionInfo.insertionIdx] = {
					userChosen: undefined,
					busStops,
					both,
					company: companies[insertionInfo.companyIdx].id,
					vehicle: insertionInfo.vehicle.id,
					tour1: prev == undefined ? undefined : prev.tourId,
					tour2: next == undefined ? undefined : next.tourId,
					event1: prev == undefined ? undefined : prev.id,
					event2: next == undefined ? undefined : next.id
				};
			}
			const nextTime =
				next == undefined
					? new Date(Date.now() + hoursToMs(240000))
					: returnsToCompany
						? next.departure
						: next.communicated;
			const fullWindowDuration = nextTime.getTime() - prevTime.getTime();
			let window: Interval | undefined = new Interval(prevTime, nextTime);
			console.log(insertionInfo.vehicle.events.length);
			console.log('aa', insertionInfo.nextEventIdx);
			console.log(next == undefined);
			console.log(insertionInfo.insertionIdx);
			console.log(insertionInfo.insertionIdx == insertionInfo.vehicle.events.length);
			const toCompanyFromUserChosen =
				routingResults.userChosen.toCompany[insertionInfo.companyIdx].duration;
			const fromCompanyToUserChosen =
				routingResults.userChosen.fromCompany[insertionInfo.companyIdx].duration;
			const fromPrevToUserChosen =
				prev == undefined
					? 0
					: routingResults.userChosen.fromPrevEvent[insertionInfo.prevEventIdx].duration;
			const toNextFromUserChosen =
				next == undefined
					? 0
					: routingResults.userChosen.toNextEvent[insertionInfo.nextEventIdx].duration;
			if (busStopIdx == undefined) {
				// insert userChosen
				if (type == (startFixed ? InsertionType.APPEND : InsertionType.PREPEND)) {
					return;
				}
				console.assert(
					insertionInfo.insertionIdx != 0 || comesFromCompany,
					'Accessing nonexistin previous event.'
				);
				console.assert(
					insertionInfo.insertionIdx != insertionInfo.vehicle.events.length || returnsToCompany,
					'Accessing nonexisting next event.'
				);
				const toInsert = startFixed ? ToInsert.DROPOFF : ToInsert.PICKUP;
				const entryExists = allInsertions[insertionInfo.insertionIdx].userChosen != undefined;
				const approachDuration = comesFromCompany ? fromCompanyToUserChosen : fromPrevToUserChosen;
				const returnDuration = returnsToCompany ? toCompanyFromUserChosen : toNextFromUserChosen;
				const cost = evaluateInsertion(
					type,
					window,
					{
						approach: approachDuration,
						return: returnDuration,
						pickupToDropoff: 0,
						toNext: next == undefined ? 0 : next.durationFromPrev,
						fromPrev: prev == undefined ? 0 : prev.durationToNext,
						fullWindow: fullWindowDuration
					},
					toInsert,
					allInsertions[insertionInfo.insertionIdx].userChosen,
					undefined,
					startFixed
				);
				console.log('cost', cost);
				if (cost == undefined) {
					return;
				}
				allInsertions[insertionInfo.insertionIdx] = {
					...allInsertions[insertionInfo.insertionIdx],
					userChosen: cost
				};
				return;
			}
			if (type != InsertionType.INSERT) {
				const relevantAvailabilities =
					type == InsertionType.CONNECT
						? insertionInfo.vehicle.availabilities.filter((availability) =>
								availability.contains(new Interval(prevTime, nextTime))
							)
						: insertionInfo.vehicle.availabilities.filter((availability) =>
								availability.covers(prevTime)
							);

				console.assert(
					relevantAvailabilities != undefined && relevantAvailabilities.length < 2,
					'Unexpectedly found 2 intervals, which are supposed to be disjoint, containing the same timestamp.'
				);
				if (relevantAvailabilities == undefined || relevantAvailabilities.length == 0) {
					return;
				}
				window = window.intersect(relevantAvailabilities[0]);
				if (window == undefined) {
					return;
				}
			}
			const busStopRoutingResult = routingResults.busStops[busStopIdx];
			const travelDuration = travelDurations[busStopIdx];
			const times = busStopTimes[busStopIdx];
			for (let timeIdx = 0; timeIdx != times.length; ++timeIdx) {
				const fromCompanyToBus =
					busStopRoutingResult.fromCompany[insertionInfo.companyIdx].duration;
				const toCompanyFromBus = busStopRoutingResult.toCompany[insertionInfo.companyIdx].duration;
				const fromPrevToBus =
					busStopRoutingResult.fromPrevEvent[insertionInfo.prevEventIdx].duration;
				const toNextFromBus =
					routingResults.userChosen.toNextEvent[insertionInfo.nextEventIdx].duration;
				// insert userChosen coordinates and busstop
				const approachDurationBoth =
					(startFixed
						? comesFromCompany
							? fromCompanyToBus
							: fromPrevToBus
						: returnsToCompany
							? toCompanyFromUserChosen
							: toNextFromUserChosen) + travelDuration;
				const returnDurationBoth =
					(startFixed
						? returnsToCompany
							? toCompanyFromUserChosen
							: toNextFromUserChosen
						: returnsToCompany
							? toCompanyFromBus
							: toNextFromBus) + travelDuration;
				const timeCostBoth = evaluateInsertion(
					type,
					window,
					{
						approach: approachDurationBoth,
						return: returnDurationBoth,
						pickupToDropoff: travelDuration,
						toNext: next == undefined ? 0 : next.durationFromPrev,
						fromPrev: prev == undefined ? 0 : prev.durationToNext,
						fullWindow: fullWindowDuration
					},
					ToInsert.BOTH,
					allInsertions[insertionInfo.insertionIdx].both[busStopIdx][timeIdx],
					times[timeIdx],
					startFixed
				);
				if (timeCostBoth == undefined) {
					continue;
				}
				allInsertions[insertionInfo.insertionIdx].both![busStopIdx][timeIdx] = timeCostBoth;

				// insert busstop
				if (type == (startFixed ? InsertionType.PREPEND : InsertionType.APPEND)) {
					return;
				}
				const toInsert = startFixed ? ToInsert.PICKUP : ToInsert.DROPOFF;
				const approachDuration = comesFromCompany ? fromCompanyToBus : fromPrevToBus;
				const returnDuration = returnsToCompany ? toCompanyFromBus : toNextFromBus;
				const timeCostBus = evaluateInsertion(
					type,
					window,
					{
						approach: approachDuration,
						return: returnDuration,
						pickupToDropoff: travelDuration,
						toNext: next == undefined ? 0 : next.durationFromPrev,
						fromPrev: prev == undefined ? 0 : prev.durationToNext,
						fullWindow: fullWindowDuration
					},
					toInsert,
					allInsertions[insertionInfo.insertionIdx].both[busStopIdx][timeIdx],
					times[timeIdx],
					startFixed
				);
				if (timeCostBus != undefined) {
					allInsertions[insertionInfo.insertionIdx].busStops[busStopIdx][timeIdx] = timeCostBus;
				}
			}
		});
	};
	iterateAllInsertions(
		ITERATE_INSERTIONS_MODE.SINGLE,
		companies,
		busStopCompanyFilter,
		possibleInsertionsByVehicle,
		insertionFn
	);
	return allInsertions;
}
