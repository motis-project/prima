import { Validator } from 'jsonschema';

export function parseTripId(isTaxi: boolean, tripId: string): Context {
	const parsedContext: unknown = isTaxi
		? (JSON.parse(tripId) as TaxiContext)
		: (JSON.parse(tripId) as RideShareContext);
	const schema = isTaxi ? taxiContextSchema : rideShareContextSchema;
	const validator = new Validator();
	const result = validator.validate(parsedContext, schema);
	if (!result.valid) {
		throw new Error();
	}
	return isTaxi
		? {
				pT: (parsedContext as TaxiContext).pickupTime,
				dT: (parsedContext as TaxiContext).dropoffTime,
				rT: (parsedContext as TaxiContext).requestedTime,
				tour: undefined
			}
		: (parsedContext as RideShareContext);
}

type TaxiContext = {
	pickupTime: number;
	dropoffTime: number;
	requestedTime: number;
};

type RideShareContext = {
	rT: number;
	pT: number;
	tour: number;
	dT: number;
};

type Context = {
	rT: number;
	pT: number;
	dT: number;
	tour?: number;
};

const rideShareContextSchema = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	type: 'object',
	properties: {
		pT: { type: 'number', minimum: 0 },
		rT: { type: 'number', minimum: 0 },
		dT: { type: 'number', minimum: 0 },
		tour: { type: 'number', minimum: 0 }
	},
	required: ['pT', 'rT', 'dT', 'tour']
};

const taxiContextSchema = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	type: 'object',
	properties: {
		pickupTime: { type: 'number', minimum: 0 },
		dropoffTime: { type: 'number', minimum: 0 },
		requestedTime: { type: 'number', minimum: 0 }
	},
	required: ['pickupTime', 'dropoffTime', 'requestedTime']
};
