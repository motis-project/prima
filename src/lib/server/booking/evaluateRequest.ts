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
	EARLIEST_SHIFT_START,
	LATEST_SHIFT_END,
	MAX_PASSENGER_WAITING_TIME_DROPOFF,
	MAX_PASSENGER_WAITING_TIME_PICKUP,
	PASSENGER_CHANGE_DURATION,
	TZ
} from '$lib/constants';
import { evaluateNewTours } from './insertion';
import { HOUR } from '$lib/util/time';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';

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
	let earliest = Number.MAX_VALUE;
	let latest = 0;
	companies.forEach((c) =>
		c.vehicles.forEach((v) => {
			v.availabilities.forEach((a) => {
				if (a.startTime < earliest) {
					earliest = a.startTime;
				}
				if (a.endTime > latest) {
					latest = a.endTime;
				}
			});
			v.tours.forEach((t) => {
				if (t.departure < earliest) {
					earliest = t.departure;
				}
				if (t.arrival > latest) {
					latest = t.arrival;
				}
			});
		})
	);
	console.log(
		'WHITELIST REQUEST: ALLOWED TIMES (RESTRICTION FROM 6 TO 21):\n',
		getAllowedTimes(earliest, latest).map((i) => i.toString())
	);
	if (earliest >= latest) {
		return busStops.map((bs) => bs.times.map((_) => undefined));
	}
	const newTourEvaluations = evaluateNewTours(
		companies,
		required,
		startFixed,
		expandedSearchInterval,
		busStopTimes,
		routingResults,
		directDurations,
		getAllowedTimes(earliest, latest),
		promisedTimes
	);
	return newTourEvaluations;
}
function getAllowedTimes(earliest: UnixtimeMs, latest: UnixtimeMs): Interval[] {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone: TZ,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	});
	latest = latest + 24 * HOUR;
	let currentTime = earliest - 24 * HOUR;
	let previousStartOfDay = -1;
	const allowedTimes: Interval[] = [];
	do {
		const currentAsDate = new Date(currentTime);
		const startOfDay = new Date(
			currentAsDate.getUTCFullYear(),
			currentAsDate.getUTCMonth(),
			currentAsDate.getUTCDate()
		).getTime();
		const shiftStart = new Date(
			new Date(formatter.format(startOfDay + EARLIEST_SHIFT_START)).toUTCString()
		).getTime();
		const shiftEnd = new Date(
			new Date(formatter.format(startOfDay + LATEST_SHIFT_END)).toUTCString()
		).getTime();
		if (startOfDay != previousStartOfDay) {
			allowedTimes.push(new Interval(shiftStart, shiftEnd));
		}
		previousStartOfDay = startOfDay;
		currentTime += 12 * HOUR;
	} while (currentTime <= latest);
	return allowedTimes;
}
