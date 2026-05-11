import type { Capacities } from '$lib/util/booking/Capacities';
import { getRideShareTours } from '$lib/server/booking/rideShare/getRideShareTours';
import { Interval } from '$lib/util/interval';
import type { Coordinates } from '$lib/util/Coordinates';
import { evaluateRequest } from '$lib/server/booking/rideShare/evaluateRequest';
import { type BusStop } from '$lib/server/booking/taxi/BusStop';
import { type Insertion } from '$lib/server/booking/rideShare/insertion';

export async function whitelistRideShare(
	userChosen: Coordinates,
	busStops: BusStop[],
	required: Capacities,
	startFixed: boolean
): Promise<Array<Insertion[][]>> {
	if (!busStops.some((b) => b.times.length !== 0)) {
		return new Array<Insertion[][]>(busStops.length);
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

	console.log(
		'INTERVAL',
		JSON.stringify({
			firstTime: new Date(firstTime).toISOString(),
			lastTime: new Date(lastTime).toISOString()
		})
	);

	const searchInterval = new Interval(firstTime, lastTime);

	const rideShareTours = await getRideShareTours(required, searchInterval);
	console.log(
		'Whitelist Request Ride Share: getRideShareTours results\n',
		JSON.stringify(
			{
				searchInterval: searchInterval.toString(),
				rideShareTours
			},
			null,
			'\t'
		)
	);
	const bestEvals = await evaluateRequest(
		rideShareTours,
		userChosen,
		busStops,
		required,
		startFixed
	);
	console.log('WLE');
	return bestEvals;
}
