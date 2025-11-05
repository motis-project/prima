import { Interval } from '$lib/util/interval';
import { error, json } from '@sveltejs/kit';
import { addAvailability } from '$lib/server/addAvailability';
import { getAvailability } from '$lib/server/getAvailability.js';
import { Validator } from 'jsonschema';
import { MINUTE } from '$lib/util/time.js';
import { deleteAvailability } from '$lib/server/deleteAvailability';

const schemaDefinitions = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	definitions: {
		times: {
			type: 'array',
			items: { type: 'integer' }
		}
	}
};

const availabilitySchema = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	type: 'object',
	properties: {
		vehicleId: { type: 'integer' },
		from: { $ref: '/schemaDefinitions#/definitions/times' },
		to: { $ref: '/schemaDefinitions#/definitions/times' },
		add: {
			type: 'array',
			items: { type: 'boolean' }
		},
		offset: { type: 'integer' },
		date: { type: 'string' }
	},
	required: ['vehicleId', 'from', 'to', 'offset', 'date']
};

type AvailabilityRequest = {
	vehicleId: number;
	from: number[];
	to: number[];
	add: boolean[];
	offset: number;
	date: string;
};

export const POST = async ({ locals, request }) => {
	const companyId = locals.session?.companyId;
	if (!companyId) {
		throw 'no company';
	}

	const body: AvailabilityRequest = await request.json();

	const validator = new Validator();
	validator.addSchema(schemaDefinitions, '/schemaDefinitions');
	const result = validator.validate(body, availabilitySchema);
	if (!result.valid) {
		return json({ message: result.errors }, { status: 400 });
	}

	const { vehicleId, from, to, add, date, offset } = body;

	if (from.length != to.length && to.length != add.length) {
		error(400, { message: 'Invalid parameters' });
	}

	let i = 0;
	while (i < from.length) {
		if (add[i]) {
			await addAvailability(from[i], to[i], companyId, vehicleId);
		} else {
			await deleteAvailability(from[i], to[i], vehicleId, companyId);
		}
		i++;
	}

	const time = new Date(date).getTime();
	if (isNaN(time)) {
		error(400, { message: 'Invalid date parameter' });
	}

	const utcDate = new Date(time + offset * MINUTE);
	const {
		companyDataComplete: _a,
		companyCoordinates: _b,
		utcDate: _c,
		...res
	} = await getAvailability(utcDate, companyId);
	res.vehicles = res.vehicles.map((v) => {
		return {
			...v,
			availability: Interval.merge(
				v.availability.map((av) => new Interval(av.startTime, av.endTime))
			).map((av) => {
				return { ...av, id: 0 };
			})
		};
	});
	return json({ ...res, from, to });
};
