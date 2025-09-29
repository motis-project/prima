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
import { MINUTE } from '$lib/util/time';
import { whitelistRideShare } from './whitelist';

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
	let directRideShare: Insertion[][] = [];
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
	let [startRideShare, targetRideShare] = await Promise.all([
		whitelistRideShare(p.start, p.startBusStops, p.capacities, false),
		whitelistRideShare(p.target, p.targetBusStops, p.capacities, true)
	]);

	assertArraySizes(startRideShare, p.startBusStops, 'Whitelist', false);
	assertArraySizes(targetRideShare, p.targetBusStops, 'Whitelist', false);

	if (p.directTimes.length != 0) {
		directRideShare = p.startFixed
			? targetRideShare[targetRideShare.length - 1]
			: startRideShare[startRideShare.length - 1];
		if (p.startFixed) {
			targetRideShare = targetRideShare.slice(0, targetRideShare.length - 1);
		} else {
			startRideShare = startRideShare.slice(0, startRideShare.length - 1);
		}
	}

	const response: WhitelistResponse = {
		start: startRideShare,
		target: targetRideShare,
		direct: filterDirectResponses(directRideShare, p.startFixed)
	};
	console.log('WHITELIST RESPONSE: ', JSON.stringify(response, null, '\t'));
	return json(response);
}

function filterDirectResponses(response: Insertion[][], startFixed: boolean): Insertion[][] {
	function getPickupTime(i: Insertion) {
		return i.scheduledPickupTimeEnd;
	}
	function getDropoffTime(i: Insertion) {
		return i.scheduledDropoffTimeStart;
	}
	function addInsertionsHourly(
		insertions: (Insertion & { idx: number })[],
		selected: (Insertion & { idx: number })[][]
	) {
		const ret = structuredClone(selected).sort((s1, s2) => getTime(s1[0]) - getTime(s2[0]));
		const tmp = insertions.sort((i1, i2) => i2.profit - i1.profit);
		for (const i of tmp) {
			const idxInRet = ret.findIndex((r) => r[0].idx === i.idx);
			if (idxInRet !== -1) {
				ret[idxInRet].push(i);
			} else if (ret.every((r) => Math.abs(getTime(i) - getTime(r[0])) >= 40 * MINUTE)) {
				ret.push([i]);
			}
		}
		return ret.sort((r1, r2) => getTime(r1[0]) - getTime(r2[0]));
	}

	const getTime = startFixed ? getPickupTime : getDropoffTime;
	const definedResponse: (Insertion & { idx: number })[][] = response
		.map((arr, idx) =>
			arr.map((r) => {
				return { ...r, idx };
			})
		)
		.filter((arr) => arr.length !== 0);
	const concatenationsPerTour = new Array<Insertion & { idx: number }>();
	for (const concatenation of definedResponse.flat()) {
		if (!concatenationsPerTour.some((c) => c.tour === concatenation.tour)) {
			concatenationsPerTour.push(concatenation);
		}
	}
	let selected = new Array<(Insertion & { idx: number })[]>();
	selected = addInsertionsHourly(concatenationsPerTour, selected);
	return response.map((r, idx) => (selected.some((s) => s[0].idx === idx) ? r : []));
}
