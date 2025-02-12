import { toBusStopWithISOStrings, type BusStop, type BusStopWithISOStrings } from '$lib/server/booking/BusStop';
import type { Capacities } from '$lib/server/booking/Capacities';
import type { Coordinates } from '$lib/util/Coordinates';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';

export type WhitelistRequest = {
	start: Coordinates;
	target: Coordinates;
	startBusStops: BusStop[];
	targetBusStops: BusStop[];
	directTimes: UnixtimeMs[];
	startFixed: boolean;
	capacities: Capacities;
};

export type WhitelistRequestWithISOStrings = {
	start: Coordinates;
	target: Coordinates;
	startBusStops: BusStopWithISOStrings[];
	targetBusStops: BusStopWithISOStrings[];
	directTimes: string[];
	startFixed: boolean;
	capacities: Capacities;
}

export function toWhitelistRequestWithISOStrings(r: WhitelistRequest): WhitelistRequestWithISOStrings {
	return {
		...r,
		startBusStops: r.startBusStops.map((b) => toBusStopWithISOStrings(b)),
		targetBusStops: r.targetBusStops.map((b) => toBusStopWithISOStrings(b)),
		directTimes: r.directTimes.map((t) => new Date(t).toISOString())
	}
}

export const schemaDefinitions = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	definitions: {
		coordinates: {
			type: 'object',
			properties: {
				lat: { type: 'number', minimum: -90, maximum: 90 },
				lng: { type: 'number', minimum: -180, maximum: 180 }
			},
			required: ['lat', 'lng']
		},
		times: {
			type: 'array',
			items: { type: 'integer' }
		},
		capacities: {
			type: 'object',
			properties: {
				passengers: { type: 'integer', minimum: 1 },
				wheelchairs: { type: 'integer', minimum: 0 },
				bikes: { type: 'integer', minimum: 0 },
				luggage: { type: 'integer', minimum: 0 }
			},
			required: ['passengers', 'wheelchairs', 'bikes', 'luggage']
		},
		location: {
			type: 'object',
			properties: {
				coordinates: { $ref: '#/definitions/coordinates' },
				address: { type: 'string' }
			},
			required: ['coordinates', 'address']
		},
		connection: {
			type: 'object',
			properties: {
				start: { $ref: '#/definitions/location' },
				target: { $ref: '#/definitions/location' },
				startTime: { type: 'integer' },
				targetTime: { type: 'integer' }
			},
			required: ['start', 'target', 'startTime', 'targetTime']
		},
		busStops: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					lat: { type: 'number', minimum: -90, maximum: 90 },
					lng: { type: 'number', minimum: -180, maximum: 180 },
					times: { $ref: '#/definitions/times' }
				},
				required: ['lat', 'lng', 'times']
			}
		}
	}
};

export const bookingSchema = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	type: 'object',
	properties: {
		connection1: {
			oneOf: [{ $ref: '/schemaDefinitions#/definitions/connection' }, { type: 'null' }]
		},
		connection2: {
			oneOf: [{ $ref: '/schemaDefinitions#/definitions/connection' }, { type: 'null' }]
		},
		capacities: { $ref: '/schemaDefinitions#/definitions/capacities' }
	},
	required: ['capacities']
};

export const whitelistSchema = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	type: 'object',
	properties: {
		start: { $ref: '/schemaDefinitions#/definitions/coordinates' },
		target: { $ref: '/schemaDefinitions#/definitions/coordinates' },
		startBusStops: { $ref: '/schemaDefinitions#/definitions/busStops' },
		targetBusStops: { $ref: '/schemaDefinitions#/definitions/busStops' },
		directTimes: { $ref: '/schemaDefinitions#/definitions/times' },
		startFixed: { type: 'boolean' },
		capacities: { $ref: '/schemaDefinitions#/definitions/capacities' }
	},
	required: [
		'start',
		'target',
		'startFixed',
		'capacities',
		'directTimes',
		'startBusStops',
		'targetBusStops'
	]
};
