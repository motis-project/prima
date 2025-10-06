import type { RequestEvent } from './$types';
import { Validator } from 'jsonschema';
import { json } from '@sveltejs/kit';
import {
	schemaDefinitions,
	toWhitelistRequestWithISOStrings,
	whitelistSchema,
	type WhitelistRequest
} from '$lib/server/util/whitelistRequest';
import { type Insertion } from '$lib/server/booking/rideShare/insertion';
import { assertArraySizes } from '$lib/testHelpers';
import { whitelistRideShare } from './whitelist';
import { groupBy } from '$lib/util/groupBy';

export type WhitelistResponse = {
	start: Insertion[][][];
	target: Insertion[][][];
	direct: Insertion[][];
};

export async function POST(event: RequestEvent) {
	const p: WhitelistRequest = await event.request.json();
	const validator = new Validator();
	validator.addSchema(schemaDefinitions, '/schemaDefinitions');
	const result = validator.validate(p, whitelistSchema);
	if (!result.valid) {
		return json({ message: result.errors }, { status: 400 });
	}

	console.log(
		'WHITELIST REQUEST PARAMS',
		JSON.stringify(toWhitelistRequestWithISOStrings(p), null, '\t')
	);
	let direct: Insertion[][] = [];
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
		whitelistRideShare(p.start, p.startBusStops, p.capacities, false),
		whitelistRideShare(p.target, p.targetBusStops, p.capacities, true)
	]);

	assertArraySizes(start, p.startBusStops, 'Whitelist', false);
	assertArraySizes(target, p.targetBusStops, 'Whitelist', false);

	if (p.directTimes.length != 0) {
		direct = p.startFixed ? target[target.length - 1] : start[start.length - 1];
		if (p.startFixed) {
			target = target.slice(0, target.length - 1);
		} else {
			start = start.slice(0, start.length - 1);
		}
	}

	const directByTourId = groupBy(
		direct.flatMap((d, idx) =>
			d.map((d2) => {
				return { ...d2, idx };
			})
		),
		(d) => d.tour,
		(d) => d
	);
	const directResponse = new Array<Insertion[]>(direct.length);
	for (const [idx, _] of directResponse.entries()) {
		directResponse[idx] = new Array<Insertion>();
	}
	for (const [_, insertions] of directByTourId) {
		const best = insertions.reduce(
			(curr, best) => (best = curr.profit > best.profit ? curr : best),
			insertions[0]
		);
		directResponse[best.idx].push(best);
	}
	const response: WhitelistResponse = {
		start,
		target,
		direct: directResponse
	};
	console.log('RIDESHARE WHITELIST RESPONSE: ', JSON.stringify(response, null, '\t'));
	return json(response);
}
