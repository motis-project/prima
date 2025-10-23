#!/usr/bin/env ts-node

import 'dotenv/config';
import { whitelist } from '../../src/routes/api/whitelist/whitelist';
import { type WhitelistRequest } from '../../src/lib/server/util/whitelistRequest';
import { Insertion } from '../../src/lib/server/booking/taxi/insertion';
import { Coordinates } from '../../src/lib/util/Coordinates';
import { BusStop } from '../../src/lib/server/booking/taxi/BusStop';
import { Capacities } from '../../src/lib/util/booking/Capacities';

const params: {
	start: Coordinates;
	target: Coordinates;
	startBusStops: BusStop[];
	targetBusStops: BusStop[];
	directTimes: string[];
	startFixed: boolean;
	capacities: Capacities;
} = {
	start: {
		lat: 51.5393992,
		lng: 14.5316092
	},
	target: {
		lat: 51.4804411,
		lng: 14.7708978
	},
	startBusStops: [],
	targetBusStops: [
		{
			lat: 51.505442,
			lng: 14.638026999999997,
			times: [
				'2025-10-25T17:40:00.000Z',
				'2025-10-25T18:40:00.000Z',
				'2025-10-25T19:40:00.000Z',
				'2025-10-25T20:40:00.000Z',
				'2025-10-26T05:25:00.000Z'
			]
		},
		{
			lat: 51.516359,
			lng: 14.718338999999999,
			times: ['2025-10-25T17:56:00.000Z', '2025-10-25T19:56:00.000Z']
		}
	],
	directTimes: [
		'2025-10-25T18:40:00.000Z',
		'2025-10-25T18:45:00.000Z',
		'2025-10-25T18:50:00.000Z',
		'2025-10-25T18:55:00.000Z',
		'2025-10-25T19:00:00.000Z',
		'2025-10-25T19:05:00.000Z',
		'2025-10-25T19:10:00.000Z',
		'2025-10-25T19:15:00.000Z',
		'2025-10-25T19:20:00.000Z',
		'2025-10-25T19:25:00.000Z',
		'2025-10-25T19:30:00.000Z',
		'2025-10-25T19:35:00.000Z',
		'2025-10-25T19:40:00.000Z',
		'2025-10-25T19:45:00.000Z',
		'2025-10-25T19:50:00.000Z',
		'2025-10-25T19:55:00.000Z',
		'2025-10-25T20:00:00.000Z',
		'2025-10-25T20:05:00.000Z',
		'2025-10-25T20:10:00.000Z',
		'2025-10-25T20:15:00.000Z',
		'2025-10-25T20:20:00.000Z',
		'2025-10-25T20:25:00.000Z',
		'2025-10-25T20:30:00.000Z',
		'2025-10-25T20:35:00.000Z',
		'2025-10-25T20:40:00.000Z',
		'2025-10-25T20:45:00.000Z',
		'2025-10-25T20:50:00.000Z',
		'2025-10-25T20:55:00.000Z'
	],
	startFixed: true,
	capacities: {
		wheelchairs: 0,
		bikes: 0,
		passengers: 2,
		luggage: 0
	}
};

async function main() {
	const p: WhitelistRequest = {
		...params,
		startBusStops: params.startBusStops.map((b) => {
			return { ...b, times: b.times.map((t: string) => new Date(t).getTime()) };
		}),
		targetBusStops: params.targetBusStops.map((b) => {
			return { ...b, times: b.times.map((t: string) => new Date(t).getTime()) };
		}),
		directTimes: params.directTimes.map((t) => new Date(t).getTime())
	};
	let direct: (Insertion | undefined)[] = [];
	if (p.directTimes.length != 0) {
		if (p.startFixed) {
			p.targetBusStops.push({
				...p.start,
				times: p.directTimes
			});
		} else {
			p.startBusStops.push({
				...p.target,
				times: p.directTimes
			});
		}
	}
	let [start, target] = await Promise.all([
		whitelist(p.start, p.startBusStops, p.capacities, false),
		whitelist(p.target, p.targetBusStops, p.capacities, true)
	]);

	if (p.directTimes.length != 0) {
		direct = p.startFixed ? target[target.length - 1] : start[start.length - 1];
		if (p.startFixed) {
			target = target.slice(0, target.length - 1);
		} else {
			start = start.slice(0, start.length - 1);
		}
	}

	console.assert(
		direct.length === p.directTimes.length,
		'Array size mismatch in Whitelist - direct.'
	);

	const response = {
		start,
		target,
		direct
	};
	console.log(JSON.stringify(response, null, 2));
}

main().catch((err) => {
	console.error('Error during booking:', err);
	process.exit(1);
});
