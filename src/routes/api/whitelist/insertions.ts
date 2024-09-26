import type { Company, Event } from '$lib/compositionTypes';
import { Interval } from '$lib/interval';
import { ITERATE_INSERTIONS_MODE, iterateAllInsertions } from './utils';
import { type RoutingResults } from './routing';
import type { Range } from './capacitySimulation';
import { minutesToMs } from '$lib/time_utils';
import {
	MIN_PREP_MINUTES,
	PASSENGER_CHANGE_TIME,
	PASSENGER_TIME_COST_FACTOR,
	TAXI_DRIVING_TIME_COST_FACTOR,
	TAXI_WAITING_TIME_COST_FACTOR
} from '$lib/constants';

enum InsertionType {
	CONNECT,
	APPEND,
	PREPEND,
	INSERT
}

enum ToInsert {
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
};

type Insertion = {
	userChosen: TimeCost;
	busStops: TimeCost[][];
	both: TimeCost[][];
	approachDuration: number | undefined;
	returnDuration: number | undefined;
	company: number;
	vehicle: number;
	tour1: number;
	tour2: number;
	event1: number;
	event2: number;
};

type InsertionDurations = {
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
	let arrivalWindow =
		window.getDurationMs() < fullDuration
			? undefined
			: window.shrink(durations.approach, durations.return);
	if (busStopWindow != undefined) {
		arrivalWindow = arrivalWindow?.intersect(busStopWindow);
	}
	if (arrivalWindow == undefined) {
		return undefined;
	}
	const cost = computeCosts(type, durations, toInsert);
	if (currentBest == undefined || currentBest.cost.total <= cost.total) {
		return undefined;
	}
	return {
		time: startFixed ? arrivalWindow.startTime : arrivalWindow.endTime,
		cost
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
				console.assert(type != InsertionType.APPEND, 'Trying to Append a Pickup event.');
				return durations.return;
			case ToInsert.DROPOFF:
				console.assert(type != InsertionType.PREPEND, 'Trying to Prepend a Dropoff event.');
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
): Insertion[][] {
	const allInsertions = new Array<Insertion[]>();
	iterateAllInsertions(
		ITERATE_INSERTIONS_MODE.SINGLE,
		companies,
		busStopCompanyFilter,
		possibleInsertionsByVehicle,
		(busStopIdx, companyIdx, prevEventIdx, nextEventIdx, vehicle, insertionIdx, _) => {
			if (prevEventIdx == undefined) {
				return;
			}
			if (nextEventIdx == undefined) {
				return;
			}
			const prev: Event | undefined =
				insertionIdx == 0 ? undefined : vehicle.events[insertionIdx - 1];
			const next: Event | undefined =
				insertionIdx == vehicle.events.length ? undefined : vehicle.events[insertionIdx];
			cases.forEach((type) => {
				if (type == (startFixed ? InsertionType.APPEND : InsertionType.PREPEND)) {
					return;
				}
				if (
					prev == undefined ||
					next == undefined ||
					(prev.tourId == next.tourId) != (type == InsertionType.INSERT)
				) {
					return;
				}
				const returnsToCompany = type === InsertionType.CONNECT || type === InsertionType.APPEND;
				const comesFromCompany = type === InsertionType.CONNECT || type === InsertionType.PREPEND;

				const prevTime = comesFromCompany ? prev.arrival : prev.communicated;
				if (prevTime < new Date(Date.now() + minutesToMs(MIN_PREP_MINUTES))) {
					return;
				}
				const nextTime = returnsToCompany ? next.departure : next.communicated;
				const fullWindowDuration = nextTime.getTime() - prevTime.getTime();
				let window: Interval | undefined = new Interval(prevTime, nextTime);
				if (busStopIdx == undefined) {
					// insert userChosen
					if (type == (startFixed ? InsertionType.PREPEND : InsertionType.APPEND)) {
						return;
					}
					const approachDuration = comesFromCompany
						? routingResults.userChosen.fromCompany[companyIdx].duration
						: routingResults.userChosen.fromPrevEvent[prevEventIdx].duration;
					const returnDuration = returnsToCompany
						? routingResults.userChosen.toCompany[companyIdx].duration
						: routingResults.userChosen.toNextEvent[nextEventIdx].duration;
					const toInsert = startFixed ? ToInsert.DROPOFF : ToInsert.PICKUP;
					const cost = evaluateInsertion(
						type,
						window,
						{
							approach: approachDuration,
							return: returnDuration,
							pickupToDropoff: 0,
							toNext: next.durationFromPrev,
							fromPrev: prev.durationToNext,
							fullWindow: fullWindowDuration
						},
						toInsert,
						allInsertions[insertionIdx][toInsert].userChosen,
						undefined,
						startFixed
					);
					if (cost == undefined) {
						return;
					}
					allInsertions[insertionIdx][toInsert].userChosen = cost;
					return;
				}
				const relevantAvailabilities = (function () {
					switch (type) {
						case InsertionType.APPEND:
							return vehicle.availabilities.filter((availability) => availability.covers(prevTime));
						case InsertionType.PREPEND:
							return vehicle.availabilities.filter((availability) => availability.covers(nextTime));
						case InsertionType.CONNECT:
							return vehicle.availabilities.filter((availability) =>
								availability.contains(new Interval(prevTime, nextTime))
							);
						case InsertionType.INSERT:
							console.assert(false, 'unexpected InsertionType in computeTravelDurations');
					}
				})();

				console.assert(
					relevantAvailabilities != undefined && relevantAvailabilities.length < 2,
					'Unexpectedly found 2 intervals, which are supposed to be disjoint, containing the same timestamp.'
				);
				if (relevantAvailabilities == undefined || relevantAvailabilities.length == 0) {
					return;
				}
				const relevantAvailability = relevantAvailabilities[0];
				window = window.intersect(relevantAvailability);
				if (window == undefined) {
					return;
				}
				const busStopRoutingResult = routingResults.busStops[busStopIdx];
				const travelDuration = travelDurations[busStopIdx];
				const times = busStopTimes[busStopIdx];
				for (let timeIdx = 0; timeIdx != times.length; ++timeIdx) {
					// insert busstop
					const approachDuration = comesFromCompany
						? busStopRoutingResult.fromCompany[companyIdx].duration
						: busStopRoutingResult.fromPrevEvent[prevEventIdx].duration;
					const returnDuration = returnsToCompany
						? busStopRoutingResult.toCompany[companyIdx].duration
						: busStopRoutingResult.toNextEvent[nextEventIdx].duration;
					const bestTime = getBestTime(
						approachDuration,
						returnDuration,
						window,
						times[timeIdx],
						startFixed
					);
					if (bestTime != undefined) {
						const toInsert = startFixed ? ToInsert.PICKUP : ToInsert.DROPOFF;
						const timeCost = evaluateInsertion(
							type,
							window,
							{
								approach: approachDuration,
								return: returnDuration,
								pickupToDropoff: travelDuration,
								toNext: next.durationFromPrev,
								fromPrev: prev.durationToNext,
								fullWindow: fullWindowDuration
							},
							toInsert,
							allInsertions[insertionIdx][toInsert].both[busStopIdx][timeIdx],
							times[timeIdx],
							startFixed
						);
						if (timeCost != undefined) {
							allInsertions[insertionIdx][toInsert].busStops[busStopIdx][timeIdx] = timeCost;
						}
					}

					// insert userChosen coordinates and busstop
					const approachDurationBoth =
						(startFixed
							? comesFromCompany
								? busStopRoutingResult.fromCompany[companyIdx].duration
								: busStopRoutingResult.fromPrevEvent[prevEventIdx].duration
							: comesFromCompany
								? routingResults.userChosen.fromCompany[companyIdx].duration
								: routingResults.userChosen.fromPrevEvent[prevEventIdx].duration) + travelDuration;
					const returnDurationBoth =
						(startFixed
							? returnsToCompany
								? routingResults.userChosen.toCompany[nextEventIdx].duration
								: routingResults.userChosen.toNextEvent[nextEventIdx].duration
							: returnsToCompany
								? busStopRoutingResult.toCompany[companyIdx].duration
								: busStopRoutingResult.toNextEvent[nextEventIdx].duration) + travelDuration;
					const bestTimeBoth = getBestTime(
						approachDurationBoth,
						returnDurationBoth,
						window,
						times[timeIdx],
						startFixed
					);
					if (bestTimeBoth == undefined) {
						continue;
					}
					const timeCost = evaluateInsertion(
						type,
						window,
						{
							approach: approachDurationBoth,
							return: returnDurationBoth,
							pickupToDropoff: travelDuration,
							toNext: next.durationFromPrev,
							fromPrev: prev.durationToNext,
							fullWindow: fullWindowDuration
						},
						ToInsert.BOTH,
						allInsertions[insertionIdx][ToInsert.BOTH].both[busStopIdx][timeIdx],
						times[timeIdx],
						startFixed
					);
					if (timeCost == undefined) {
						continue;
					}
					allInsertions[insertionIdx][ToInsert.BOTH].both[busStopIdx][timeIdx] = timeCost;
				}
			});
		}
	);
	return allInsertions;
}
