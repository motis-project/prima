import type { BusStop } from './busStop';
import type { Capacities } from './capacities';
import type { Coordinates } from './location';

export type CheckBookingValidityParameters = {
	userChosen: Coordinates;
	busStops: BusStop[];
	startFixed: boolean;
	capacities: Capacities;
};

export const schema = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	type: 'object',
	definitions: {
		coordinates: {
			type: 'object',
			properties: {
				lat: {
					type: 'number',
					minimum: -90,
					maximum: 90
				},
				lng: {
					type: 'number',
					minimum: -180,
					maximum: 180
				}
			},
			required: ['lat', 'lng']
		}
	},
	properties: {
		userChosen: {
			$ref: '#/definitions/coordinates'
		},
		busStops: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					coordinates: {
						$ref: '#/definitions/coordinates'
					},
					times: {
						type: 'array',
						items: {
							type: 'string',
							format: 'date-time'
						}
					}
				},
				required: ['coordinates', 'times']
			}
		},
		startFixed: {
			type: 'boolean'
		},
		capacities: {
			type: 'object',
			properties: {
				passengers: {
					type: 'integer',
					minimum: 0
				},
				wheelchairs: {
					type: 'integer',
					minimum: 0
				},
				bikes: {
					type: 'integer',
					minimum: 0
				},
				luggage: {
					type: 'integer',
					minimum: 0
				}
			},
			required: ['passengers', 'wheelchairs', 'bikes', 'luggage']
		}
	},
	required: ['userChosen', 'busStops', 'startFixed', 'capacities']
};
