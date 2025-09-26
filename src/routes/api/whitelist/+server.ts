import type { RequestEvent } from './$types';
import { Validator } from 'jsonschema';
import { json } from '@sveltejs/kit';
import { whitelist } from './whitelist';
import {
	schemaDefinitions,
	toWhitelistRequestWithISOStrings,
	whitelistSchema,
	type WhitelistRequest
} from './WhitelistRequest';
import { toInsertionWithISOStrings, type Insertion } from '$lib/server/booking/taxi/insertion';
import { type Insertion as RideShareInsertion } from '$lib/server/booking/rideShare/insertion';
import { assertArraySizes } from '$lib/testHelpers';
import { MINUTE } from '$lib/util/time';
import { InsertHow } from '$lib/util/booking/insertionTypes';
import { whitelistRideShare } from './whitelistRideShare';

export type WhitelistResponse = {
	start: (Insertion | undefined)[][];
	target: (Insertion | undefined)[][];
	direct: (Insertion | undefined)[];
	startRideShare: RideShareInsertion[][][];
	targetRideShare: RideShareInsertion[][][];
	directRideShare: RideShareInsertion[][];
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
	let direct: (Insertion | undefined)[] = [];
	let directRideShare: RideShareInsertion[][] = [];
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
	let [start, target, startRideShare, targetRideShare] = await Promise.all([
		whitelist(p.start, p.startBusStops, p.capacities, false),
		whitelist(p.target, p.targetBusStops, p.capacities, true),
		whitelistRideShare(p.start, p.startBusStops, p.capacities, false),
		whitelistRideShare(p.target, p.targetBusStops, p.capacities, true)
	]);

	assertArraySizes(start, p.startBusStops, 'Whitelist', false);
	assertArraySizes(target, p.targetBusStops, 'Whitelist', false);
	assertArraySizes(startRideShare, p.startBusStops, 'Whitelist', false);
	assertArraySizes(targetRideShare, p.targetBusStops, 'Whitelist', false);

	if (p.directTimes.length != 0) {
		direct = p.startFixed ? target[target.length - 1] : start[start.length - 1];
		directRideShare = p.startFixed
			? targetRideShare[targetRideShare.length - 1]
			: startRideShare[startRideShare.length - 1];
		if (p.startFixed) {
			target = target.slice(0, target.length - 1);
			targetRideShare = targetRideShare.slice(0, targetRideShare.length - 1);
		} else {
			start = start.slice(0, start.length - 1);
			startRideShare = startRideShare.slice(0, startRideShare.length - 1);
		}
	}

	console.assert(
		direct.length === p.directTimes.length,
		'Array size mismatch in Whitelist - direct.'
	);

	const response: WhitelistResponse = {
		start,
		target,
		direct: filterDirectResponses(direct, p.startFixed),
		startRideShare,
		targetRideShare,
		directRideShare
	};
	console.log(
		'WHITELIST RESPONSE: ',
		JSON.stringify(toWhitelistResponseWithISOStrings(response), null, '\t')
	);
	return json(response);
}

function toWhitelistResponseWithISOStrings(r: WhitelistResponse) {
	return {
		start: r.start.map((i) => i.map((j) => toInsertionWithISOStrings(j))),
		target: r.target.map((i) => i.map((j) => toInsertionWithISOStrings(j))),
		direct: r.direct.map((j) => toInsertionWithISOStrings(j))
	};
}

function filterDirectResponses<T extends Insertion | RideShareInsertion>(
	response: (T | undefined)[],
	startFixed: boolean
): (T | undefined)[] {
	function getPickupTime(i: T) {
		return i.scheduledPickupTimeEnd;
	}
	function getDropoffTime(i: T) {
		return i.scheduledDropoffTimeStart;
	}
	function addInsertionsHourly(
		insertions: (T & { idx: number })[],
		selected: (T & { idx: number })[]
	) {
		const ret = structuredClone(selected).sort((s1, s2) => getTime(s1) - getTime(s2));
		const tmp = insertions.sort((i1, i2) => i1.cost - i2.cost);
		for (const i of tmp) {
			if (ret.every((r) => Math.abs(getTime(i) - getTime(r)) >= 40 * MINUTE)) {
				ret.push(i);
			}
		}
		return ret.sort((r1, r2) => getTime(r1) - getTime(r2));
	}

	const getTime = startFixed ? getPickupTime : getDropoffTime;
	const definedResponse: (T & { idx: number })[] = response
		.map((r, idx) => (r === undefined ? undefined : { ...r, idx }))
		.filter((r) => r !== undefined);
	const concatenations = definedResponse
		.filter((r) => r.pickupCase.how !== InsertHow.NEW_TOUR)
		.sort((r1, r2) => r1.cost - r2.cost);
	const concatenationsPerTour = new Array<T & { idx: number }>();
	for (const concatenation of concatenations) {
		if (!concatenationsPerTour.some((c) => c.tour === concatenation.tour)) {
			concatenationsPerTour.push(concatenation);
		}
	}
	const newTours = definedResponse
		.filter((r) => r.pickupCase.how === InsertHow.NEW_TOUR)
		.sort((t1, t2) => t1.cost - t2.cost);
	let selected = new Array<T & { idx: number }>();
	let expensiveConcatenations = new Array<T & { idx: number }>();
	const cutoff = newTours.length === 0 ? Number.MAX_VALUE : newTours[0].cost;
	selected = concatenationsPerTour.filter((c) => c.cost < cutoff);
	expensiveConcatenations = concatenationsPerTour.filter((c) => c.cost >= cutoff);
	selected = addInsertionsHourly(newTours, selected);
	selected = addInsertionsHourly(expensiveConcatenations, selected);
	return response.map((r, idx) => (selected.some((s) => s.idx === idx) ? r : undefined));
}
