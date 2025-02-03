import type { Capacities } from "$lib/booking/Capacities";
import type { Coordinates } from "$lib/util/Location";
import type { UnixtimeMs } from "$lib/util/UnixtimeMs";

export type BusStop = Coordinates & {
  times: UnixtimeMs[];
};

export type WhitelistRequest = {
  start: Coordinates;
  target: Coordinates;
  startBusStops: BusStop[];
  targetBusStops: BusStop[];
  times: UnixtimeMs[];
  startFixed: boolean;
  capacities: Capacities;
};

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
      }
    },
    connection: {
      type: 'object',
      properties: {
        start: { $ref: '#/definitions/location' },
        target: { $ref: '#/definitions/location' },
        startTime: { type: 'integer' },
        targetTime: { type: 'integer' }
      }
    },
    busStops: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          allOf: [
            { $ref: '#/definitions/coordinates' },
            {
              times: { $ref: '#/definitions/times' }
            }
          ]
        },
        required: ['lat', 'lng', 'times']
      }
    }
  }
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
  required: ['start', 'target', 'startFixed', 'capacities', 'directTimes', 'startBusStops', 'targetBusStops']
};