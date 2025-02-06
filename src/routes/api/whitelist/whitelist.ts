import type { Capacities } from '$lib/server/booking/Capacities';
import { getBookingAvailability } from '$lib/server/booking/getBookingAvailability';
import { MAX_TRAVEL } from '$lib/constants';
import { Interval } from '$lib/server/util/interval';
import type { Coordinates } from '$lib/util/Coordinates';
import { evaluateRequest } from '$lib/server/booking/evaluateRequest';
import type { BusStop } from '$lib/server/booking/BusStop';
import type { Insertion } from '$lib/server/booking/insertion';
import { InsertHow, printInsertionType } from '$lib/server/booking/insertionTypes';

export async function whitelist(
	userChosen: Coordinates,
	busStops: BusStop[],
	required: Capacities,
	startFixed: boolean
): Promise<Array<(Insertion | undefined)[]>> {
	console.log(
		'Whitelist Request: ',
		JSON.stringify(
			{
				userChosen,
				busStops: busStops.map((b) => {
					return { ...b, times: b.times.map((t) => new Date(t).toISOString()) };
				}),
				required,
				startFixed
			},
			null,
			'\t'
		)
	);

	if (busStops.length == 0) {
		return [];
	}

	let lastTime = 0;
	let firstTime = Number.MAX_VALUE;
	for (let busStopIdx = 0; busStopIdx != busStops.length; ++busStopIdx) {
		for (let timeIdx = 0; timeIdx != busStops[busStopIdx].times.length; ++timeIdx) {
			const time = busStops[busStopIdx].times[timeIdx];
			if (time < firstTime) {
				firstTime = time;
			}
			if (time > lastTime) {
				lastTime = time;
			}
		}
	}
	const searchInterval = new Interval(firstTime, lastTime);
	const expandedSearchInterval = searchInterval.expand(MAX_TRAVEL * 6, MAX_TRAVEL * 6);

	const { companies, filteredBusStops } = await getBookingAvailability(
		userChosen,
		required,
		searchInterval,
		busStops
	);
	console.log('Whitelist Request: ', JSON.stringify({ companies, filteredBusStops }, null, '\t'));

	const validBusStops = new Array<BusStop>();
	for (let i = 0; i != filteredBusStops.length; ++i) {
		if (filteredBusStops[i] != undefined) {
			validBusStops.push(busStops[i]);
		}
	}
	const bestEvals = await evaluateRequest(
		companies,
		expandedSearchInterval,
		userChosen,
		validBusStops,
		required,
		startFixed
	);
	const ret = new Array<(Insertion | undefined)[]>(filteredBusStops.length);
	for (let i = 0; i != filteredBusStops.length; ++i) {
		if (filteredBusStops[i] == undefined) {
			ret[i] = new Array<undefined>(busStops[i].times.length);
		} else {
			ret[i] = bestEvals[filteredBusStops[i]!];
		}
	}
	console.log('WLE');
	return ret;
}

export function printMsg(b: Insertion | undefined) {
	if (b == undefined) {
		console.log('    not possible');
		return;
	}
	if (b.pickupIdx == undefined) {
		console.assert(b.dropoffIdx == undefined, 'dropoffIdx==undefined unexpectedly');
		console.assert(
			b.pickupCase.how == b.dropoffCase.how && b.pickupCase.how == InsertHow.NEW_TOUR,
			"undefined pickupIdx doesn't yield NEW_TOUR"
		);
		console.log('    accepted as new tour');
		return;
	}
	console.assert(
		b.pickupIdx != undefined &&
			b.dropoffIdx != undefined &&
			b.pickupCase.how != InsertHow.NEW_TOUR &&
			b.dropoffCase.how != InsertHow.NEW_TOUR,
		'defined pickupIdx has unexpected behaviour'
	);
	if (b.pickupIdx == b.dropoffIdx) {
		console.log(
			'    inserted at same position as: ',
			printInsertionType(b.pickupCase),
			'   idx: ',
			b.pickupIdx
		);
		return;
	}
}
