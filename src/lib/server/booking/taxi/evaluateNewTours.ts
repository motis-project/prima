import { env } from '$env/dynamic/public';
import { MIN_PREP, MIN_PREP_BOOKING } from '$lib/constants';
import type { Capacities } from '$lib/util/booking/Capacities';
import { isValid } from '$lib/util/booking/getPossibleInsertions';
import { InsertHow, InsertWhat } from '$lib/util/booking/insertionTypes';
import type { Interval } from '$lib/util/interval';
import { InsertDirection, InsertWhere, type InsertionInfo } from '../insertionTypes';
import { getAllowedOperationTimes } from './durations';
import type { Company } from './getBookingAvailability';
import { evaluateBothInsertion, type Insertion } from './insertion';
import type { PromisedTimes } from './PromisedTimes';
import type { RoutingResults } from './routing';

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
	let prepTime = Date.now() + (promisedTimes === undefined ? MIN_PREP : MIN_PREP_BOOKING);
	const now = new Date();
	const isWeekend =
		(now.getDay() == 5 && now.getHours() >= 18) || now.getDay() == 6 || now.getDay() == 0;
	if (isWeekend && env.PUBLIC_ENABLE_WEEKEND_BOOKING !== 'true') {
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
				vehicle,
				allowedTimes
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
