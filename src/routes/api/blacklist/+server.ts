import { Validator } from 'jsonschema';
import { getViableBusStops, type BlacklistingResult } from './viableBusStops';
import type { RequestEvent } from './$types';
import { json } from '@sveltejs/kit';
import {
	schemaDefinitions,
	toWhitelistRequestWithISOStrings,
	whitelistSchema
} from '../whitelist/WhitelistRequest';
import { type WhitelistRequest as BlacklistRequest } from '../whitelist/WhitelistRequest';
import type { BusStop } from '$lib/server/booking/BusStop';
import { assertArraySizes } from '$lib/testHelpers';

export const POST = async (event: RequestEvent) => {
	// Validate parameters.
	const parameters: BlacklistRequest = await event.request.json();
	const validator = new Validator();
	validator.addSchema(schemaDefinitions, '/schemaDefinitions');
	const result = validator.validate(parameters, whitelistSchema);
	if (!result.valid) {
		return json({ message: result.errors }, { status: 400 });
	}

	console.log(
		'BLACKLIST PARAMS: ',
		JSON.stringify(toWhitelistRequestWithISOStrings(parameters), null, '\t')
	);

	// Add direct lookup to either start or target.
	const directAsBusStop = {
		...(parameters.startFixed ? parameters.start : parameters.target),
		times: parameters.directTimes
	};
	if (parameters.startFixed) {
		parameters.targetBusStops.push(directAsBusStop);
	} else {
		parameters.startBusStops.push(directAsBusStop);
	}

	// Database lookup.
	const [start, target] = await Promise.all([
		getViableBusStops(parameters.start, parameters.startBusStops, false, parameters.capacities),
		getViableBusStops(parameters.target, parameters.targetBusStops, true, parameters.capacities)
	]);

	// Convert response.
	const createResponse = (allowedConnections: BlacklistingResult[], busStops: BusStop[]) => {
		const response = new Array<boolean[]>(busStops.length);
		for (let i = 0; i != response.length; ++i) {
			response[i] = new Array<boolean>(busStops[i].times.length);
			for (let j = 0; j != response[i].length; ++j) {
				response[i][j] = false;
			}
		}
		allowedConnections.forEach((s) => {
			response[s.busStopIndex][s.timeIndex] = true;
		});
		return response;
	};
	let startResponse = createResponse(start, parameters.startBusStops);
	let targetResponse = createResponse(target, parameters.targetBusStops);

	assertArraySizes(targetResponse, parameters.targetBusStops, 'Blacklist', true);
	assertArraySizes(startResponse, parameters.startBusStops, 'Blacklist', true);

	// Extract direct response.
	const directResponse = parameters.startFixed
		? targetResponse[targetResponse.length - 1]
		: startResponse[startResponse.length - 1];
	if (parameters.startFixed) {
		targetResponse = targetResponse.slice(0, targetResponse.length - 1);
	} else {
		startResponse = startResponse.slice(0, startResponse.length - 1);
	}

	console.assert(
		directResponse.length === parameters.directTimes.length,
		'Array size mismatch in Blacklist - direct.'
	);
	for (let i = 0; i != directResponse.length; ++i) {
		console.assert(
			directResponse[i] != null && directResponse[i] != undefined,
			'Undefined in Blacklist Response. - direct'
		);
	}

	console.log('BLACKLIST RESPONSE: ', { startResponse, targetResponse, directResponse });
	return json({ start: startResponse, target: targetResponse, direct: directResponse });
};
