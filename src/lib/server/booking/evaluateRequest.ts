import { batchOneToManyCarRouting } from '$lib/server/util/batchOneToManyCarRouting';
import { Interval } from '$lib/server/util/interval';
import type { Coordinates } from '$lib/util/Coordinates';
import type { BusStop } from './BusStop';
import type { Capacities } from './Capacities';
import { getPossibleInsertions } from './getPossibleInsertions';
import type { Company } from './getBookingAvailability';
import type { PromisedTimes } from './PromisedTimes';
import type { Range } from './getPossibleInsertions';
import { gatherRoutingCoordinates, routing } from './routing';
import {
	BUFFER_TIME,
	MAX_PASSENGER_WAITING_TIME_DROPOFF,
	MAX_PASSENGER_WAITING_TIME_PICKUP,
	PASSENGER_CHANGE_DURATION
} from '$lib/constants';
import { evaluateNewTours } from './insertion';

export async function evaluateRequest(
	companies: Company[],
	expandedSearchInterval: Interval,
	userChosen: Coordinates,
	busStops: BusStop[],
	required: Capacities,
	startFixed: boolean,
	promisedTimes?: PromisedTimes
) {
	if (companies.length == 0) {
		return busStops.map((bs) => bs.times.map((_) => undefined));
	}
	const directDurations = (await batchOneToManyCarRouting(userChosen, busStops, startFixed)).map(
		(duration) =>
			duration === undefined ? undefined : duration + PASSENGER_CHANGE_DURATION + BUFFER_TIME
	);
	const insertionRanges = new Map<number, Range[]>();
	companies.forEach((company) =>
		company.vehicles.forEach((vehicle) => {
			insertionRanges.set(vehicle.id, getPossibleInsertions(vehicle, required, vehicle.events));
		})
	);
	const routingResults = await routing(
		companies,
		gatherRoutingCoordinates(companies, insertionRanges),
		userChosen,
		busStops,
		startFixed
	);
	const busStopTimes = busStops.map((bs) =>
		bs.times.map(
			(t) =>
				new Interval(
					startFixed ? t : t - MAX_PASSENGER_WAITING_TIME_PICKUP,
					startFixed ? t + MAX_PASSENGER_WAITING_TIME_DROPOFF : t
				)
		)
	);
	const newTourEvaluations = evaluateNewTours(
		companies,
		required,
		startFixed,
		expandedSearchInterval,
		busStopTimes,
		routingResults,
		directDurations,
		promisedTimes
	);
	return newTourEvaluations;
}
