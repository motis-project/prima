import { Validator } from 'jsonschema';
import { getViableBusStops, type BlacklistingResult } from './viableBusStops';
import type { RequestEvent } from './$types';
import { json } from '@sveltejs/kit';
import { schemaDefinitions } from '$lib/server/util/whitelistRequest';
import {
	blacklistSchema,
	toBlacklistRequestWithISOStrings,
	type BlacklistRequest
} from './blacklistRequest';
import type { IntervalLike } from '$lib/util/interval';
import type { Coordinates } from '$lib/util/Coordinates';

export const POST = async (event: RequestEvent) => {
	// Validate parameters.
	const parameters: BlacklistRequest = await event.request.json();
	const validator = new Validator();
	validator.addSchema(schemaDefinitions, '/schemaDefinitions');
	const result = validator.validate(parameters, blacklistSchema);
	if (!result.valid) {
		return json({ message: result.errors }, { status: 400 });
	}

	console.log(
		'BLACKLIST PARAMS: ',
		JSON.stringify(toBlacklistRequestWithISOStrings(parameters), null, '\t')
	);

	// Add direct lookup to either start or target.
	const directAsBusStop = {
		...(parameters.startFixed ? parameters.start : parameters.target)
	};
	if (parameters.startFixed) {
		parameters.targetBusStops.push(directAsBusStop);
	} else {
		parameters.startBusStops.push(directAsBusStop);
	}

	// Database lookup.
	const [start, target] = await Promise.all([
		getViableBusStops(
			parameters.start,
			parameters.startBusStops,
			parameters.capacities,
			parameters.earliest,
			parameters.latest
		),
		getViableBusStops(
			parameters.target,
			parameters.targetBusStops,
			parameters.capacities,
			parameters.earliest,
			parameters.latest
		)
	]);

	// Convert response.
	const createResponse = (allowedConnections: BlacklistingResult[], busStops: Coordinates[]) => {
		const response = new Array<IntervalLike[]>(busStops.length);
		for (let i = 0; i != response.length; ++i) {
			response[i] = new Array<IntervalLike>();
		}
		allowedConnections.forEach((s) => {
			response[s.busStopIndex] = response[s.busStopIndex].concat(s.intervals);
		});
		return response;
	};
	let startResponse = createResponse(start, parameters.startBusStops);
	let targetResponse = createResponse(target, parameters.targetBusStops);

	// Extract direct response.
	const directResponse = parameters.startFixed
		? targetResponse[targetResponse.length - 1]
		: startResponse[startResponse.length - 1];
	if (parameters.startFixed) {
		targetResponse = targetResponse.slice(0, targetResponse.length - 1);
	} else {
		startResponse = startResponse.slice(0, startResponse.length - 1);
	}

	console.log('BLACKLIST RESPONSE: ', {
		startResponse: startResponse.toString(),
		targetResponse: targetResponse.toString(),
		directResponse: directResponse.toString()
	});
	return json({ start: startResponse, target: targetResponse, direct: directResponse });
};
