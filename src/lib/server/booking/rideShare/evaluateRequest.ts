import { batchOneToManyCarRouting } from '$lib/server/util/batchOneToManyCarRouting';
import { Interval } from '$lib/util/interval';
import type { Coordinates } from '$lib/util/Coordinates';
import type { Capacities } from '$lib/util/booking/Capacities';
import {
	PASSENGER_CHANGE_DURATION,
	MAX_PASSENGER_WAITING_TIME_DROPOFF,
	MAX_PASSENGER_WAITING_TIME_PICKUP
} from '$lib/constants';
import { evaluatePairInsertions, evaluateSingleInsertions, type Insertion } from './insertion';
import { DAY } from '$lib/util/time';
import { routing } from './routing';
import type { RideShareTour } from './getRideShareTours';
import type { BusStop } from '../taxi/BusStop';
import type { PromisedTimes } from '../taxi/PromisedTimes';
import { getPossibleInsertions, type Range } from '$lib/util/booking/getPossibleInsertions';

export async function evaluateRequest(
	rideShareTours: RideShareTour[],
	userChosen: Coordinates,
	busStops: BusStop[],
	required: Capacities,
	startFixed: boolean,
	promisedTimes?: PromisedTimes
): Promise<Insertion[][][]> {
	console.log(
		'EVALUATE REQUEST PARAMS RIDE SHARE: ',
		{ rideShareTours: JSON.stringify(rideShareTours, null, 2) },
		{ userChosen },
		{ busStops: JSON.stringify(busStops, null, 2) },
		{ required },
		{ startFixed },
		{ promisedTimes }
	);
	if (rideShareTours.length == 0) {
		return busStops.map((bs) => bs.times.map((_) => new Array<Insertion>()));
	}
	const directDurations = (await batchOneToManyCarRouting(userChosen, busStops, startFixed)).map(
		(duration) => (duration === undefined ? undefined : duration + PASSENGER_CHANGE_DURATION)
	);
	const insertionRanges = new Map<number, Range[]>();
	rideShareTours.forEach((tour) =>
		insertionRanges.set(tour.rideShareTour, getPossibleInsertions(tour, required, tour.events))
	);

	const routingResults = await routing(rideShareTours, userChosen, busStops, insertionRanges);

	const busStopTimes = busStops.map((bs) =>
		bs.times.map(
			(t) =>
				new Interval(
					startFixed ? t : t - MAX_PASSENGER_WAITING_TIME_DROPOFF,
					startFixed ? t + MAX_PASSENGER_WAITING_TIME_PICKUP : t
				)
		)
	);
	// Find the smallest Interval containing all availabilities and tours of the companies received as a parameter.
	let earliest = Number.MAX_VALUE;
	let latest = 0;
	rideShareTours.forEach((t) => {
		if (t.departure < earliest) {
			earliest = t.departure;
		}
		if (t.arrival > latest) {
			latest = t.arrival;
		}
	});
	if (earliest >= latest) {
		return busStops.map((bs) => bs.times.map((_) => new Array<Insertion>()));
	}
	earliest = Math.max(earliest, Date.now() - 2 * DAY);
	latest = Math.min(latest, Date.now() + 15 * DAY);
	const { busStopEvaluations, bothEvaluations, userChosenEvaluations } = evaluateSingleInsertions(
		rideShareTours,
		required,
		startFixed,
		insertionRanges,
		busStopTimes,
		routingResults,
		directDurations,
		promisedTimes
	);
	const pairEvaluations = evaluatePairInsertions(
		rideShareTours,
		startFixed,
		insertionRanges,
		busStopTimes,
		busStopEvaluations,
		userChosenEvaluations,
		required,
		promisedTimes === undefined
	);
	return mergeResults(bothEvaluations, pairEvaluations);
}

function mergeResults(r1: Insertion[][][], r2: Insertion[][][]) {
	const newR = new Array<Insertion[][]>(r1.length);
	for (const [idx1, _o] of r1.entries()) {
		newR[idx1] = new Array<Insertion[]>(r1[idx1].length);
		for (const [idx2, _i] of r1[idx1].entries()) {
			newR[idx1][idx2] = r1[idx1][idx2].concat(r2[idx1][idx2]);
		}
	}
	return newR;
}
