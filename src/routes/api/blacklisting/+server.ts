import { Validator } from 'jsonschema';
import { getViableBusStops } from './viableBusStops';
import type { RequestEvent } from './$types';
import { json } from '@sveltejs/kit';
import { schema } from '$lib/bookingApiParameters';

export const POST = async (event: RequestEvent) => {
	const parameters = await event.request.json();
	const validator = new Validator();
	const result = validator.validate(parameters, schema);
	if (!result.valid) {
		return json(
			{
				message: result.errors
			},
			{ status: 400 }
		);
	}
	return json(
		{
			body: JSON.stringify(
				getViableBusStops(
					parameters.userChosen,
					parameters.busStops,
					parameters.startFixed,
					parameters.capacities
				)
			)
		},
		{ status: 200 }
	);
};
