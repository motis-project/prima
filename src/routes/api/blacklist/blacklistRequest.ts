import type { Capacities } from '$lib/util/booking/Capacities';
import type { Coordinates } from '$lib/util/Coordinates';

export type BlacklistRequest = {
	start: Coordinates;
	target: Coordinates;
	startBusStops: Coordinates[];
	targetBusStops: Coordinates[];
	earliest: number;
	latest: number;
	startFixed: boolean;
	capacities: Capacities;
};

export type BlacklistRequestWithISOStrings = {
	start: Coordinates;
	target: Coordinates;
	startBusStops: Coordinates[];
	targetBusStops: Coordinates[];
	earliest: string;
	latest: string;
	startFixed: boolean;
	capacities: Capacities;
};

export function toBlacklistRequestWithISOStrings(
	r: BlacklistRequest
): BlacklistRequestWithISOStrings {
	return {
		...r,
		earliest: new Date(r.earliest).toISOString(),
		latest: new Date(r.latest).toISOString()
	};
}

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

export const blacklistSchema = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	type: 'object',
	properties: {
		start: { $ref: '/schemaDefinitions#/definitions/coordinates' },
		target: { $ref: '/schemaDefinitions#/definitions/coordinates' },
		startBusStops: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					lat: { type: 'number', minimum: -90, maximum: 90 },
					lng: { type: 'number', minimum: -180, maximum: 180 }
				},
				required: ['lat', 'lng']
			}
		},
		targetBusStops: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					lat: { type: 'number', minimum: -90, maximum: 90 },
					lng: { type: 'number', minimum: -180, maximum: 180 }
				},
				required: ['lat', 'lng']
			}
		},
		earliest: { type: 'integer' },
		latest: { type: 'integer' },
		startFixed: { type: 'boolean' },
		capacities: { $ref: '/schemaDefinitions#/definitions/capacities' },
		uuid: { type: 'string', format: 'uuid' }
	},
	required: [
		'start',
		'target',
		'startFixed',
		'capacities',
		'earliest',
		'latest',
		'startBusStops',
		'targetBusStops'
	]
};
