import type { RequestEvent } from './$types';
import { Validator } from 'jsonschema';
import { json } from '@sveltejs/kit';
import { whitelist } from './whitelist';
import {
	schemaDefinitions,
	toWhitelistRequestWithISOStrings,
	whitelistSchema,
	type WhitelistRequest
} from '$lib/server/util/whitelistRequest';
import { toInsertionWithISOStrings, type Insertion } from '$lib/server/booking/taxi/insertion';
import { assertArraySizes } from '$lib/testHelpers';
import { MINUTE } from '$lib/util/time';
import { type InsertionType } from '$lib/server/booking/insertionTypes';
import { InsertHow } from '$lib/util/booking/insertionTypes';

export type WhitelistResponseEntry = {
	requestedTime: number;
	pickupTime: number;
	dropoffTime: number;
	fullyPayedDurationDelta: number;
	taxiWaitingTime: number;
	approachPlusReturnDurationDelta: number;
	passengerDuration: number;
	cost: number;
	pickupCase: InsertionType;
	dropoffCase: InsertionType;
};

function toWhitelistResponseEntry(
	e: Insertion | undefined,
	requestedTime: number
): WhitelistResponseEntry | undefined {
	return e === undefined
		? undefined
		: {
				pickupTime: e.pickupTime,
				dropoffTime: e.dropoffTime,
				fullyPayedDurationDelta: e.fullyPayedDurationDelta,
				taxiWaitingTime: e.taxiWaitingTime,
				approachPlusReturnDurationDelta: e.approachPlusReturnDurationDelta,
				passengerDuration: e.taxiWaitingTime,
				cost: e.cost,
				requestedTime,
				pickupCase: e.pickupCase,
				dropoffCase: e.dropoffCase
			};
}

function toWhitelistResponse(r: WhitelistResult, p: WhitelistRequest): WhitelistResponse {
	return {
		start: r.start.map((s, i) =>
			s.map((s2, j) => toWhitelistResponseEntry(s2, p.startBusStops[i].times[j]))
		),
		target: r.target.map((t, i) =>
			t.map((t2, j) => toWhitelistResponseEntry(t2, p.targetBusStops[i].times[j]))
		),
		direct: filterDirectResponses(r.direct, p.startFixed).map((d, j) =>
			toWhitelistResponseEntry(d, p.directTimes[j])
		)
	};
}

type WhitelistResponse = {
	start: (WhitelistResponseEntry | undefined)[][];
	target: (WhitelistResponseEntry | undefined)[][];
	direct: (WhitelistResponseEntry | undefined)[];
};

type WhitelistResult = {
	start: (Insertion | undefined)[][];
	target: (Insertion | undefined)[][];
	direct: (Insertion | undefined)[];
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

	console.assert(
		direct.length === p.directTimes.length,
		'Array size mismatch in Whitelist - direct.'
	);

	const whitelistResult = { start, target, direct };

	console.log(
		'WHITELIST RESPONSE: ',
		JSON.stringify(toWhitelistResultWithISOStrings(whitelistResult), null, '\t')
	);
	return json(toWhitelistResponse(whitelistResult, p));
}

function toWhitelistResultWithISOStrings(r: WhitelistResult) {
	return {
		start: r.start.map((i) => i.map((j) => toInsertionWithISOStrings(j))),
		target: r.target.map((i) => i.map((j) => toInsertionWithISOStrings(j))),
		direct: r.direct.map((j) => toInsertionWithISOStrings(j))
	};
}

function filterDirectResponses(
	response: (Insertion | undefined)[],
	startFixed: boolean
): (Insertion | undefined)[] {
	function getPickupTime(i: Insertion) {
		return i.scheduledPickupTimeEnd;
	}
	function getDropoffTime(i: Insertion) {
		return i.scheduledDropoffTimeStart;
	}
	function addInsertionsHourly(
		insertions: (Insertion & { idx: number })[],
		selected: (Insertion & { idx: number })[]
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
	const definedResponse: (Insertion & { idx: number })[] = response
		.map((r, idx) => (r === undefined ? undefined : { ...r, idx }))
		.filter((r) => r !== undefined);
	const concatenations = definedResponse
		.filter((r) => r.pickupCase.how !== InsertHow.NEW_TOUR)
		.sort((r1, r2) => r1.cost - r2.cost);
	const concatenationsPerTour = new Array<Insertion & { idx: number }>();
	for (const concatenation of concatenations) {
		if (!concatenationsPerTour.some((c) => c.tour === concatenation.tour)) {
			concatenationsPerTour.push(concatenation);
		}
	}
	const newTours = definedResponse
		.filter((r) => r.pickupCase.how === InsertHow.NEW_TOUR)
		.sort((t1, t2) => t1.cost - t2.cost);
	let selected = new Array<Insertion & { idx: number }>();
	let expensiveConcatenations = new Array<Insertion & { idx: number }>();
	const cutoff = newTours.length === 0 ? Number.MAX_VALUE : newTours[0].cost;
	selected = concatenationsPerTour.filter((c) => c.cost < cutoff);
	expensiveConcatenations = concatenationsPerTour.filter((c) => c.cost >= cutoff);
	selected = addInsertionsHourly(newTours, selected);
	selected = addInsertionsHourly(expensiveConcatenations, selected);
	return response.map((r, idx) => (selected.some((s) => s.idx === idx) ? r : undefined));
}
