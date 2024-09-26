import { describe, it, expect } from 'vitest';
import { type Range } from './capacitySimulation';
import { Coordinates } from '$lib/location';
import { type RoutingResults } from './routing';
import { computeTravelDurations } from './insertions';
import type { Vehicle, Company, Event } from '$lib/compositionTypes';
import { Interval } from '$lib/interval';
import { hoursToMs } from '$lib/time_utils';

const BASE_MS = new Date(Date.now() + hoursToMs(5)).getTime();

const createDate = (h: number) => {
	return new Date(BASE_MS + hoursToMs(h));
};

const createCompany = (vehicles: Vehicle[], coordinates: Coordinates): Company => {
	return {
		id: 1,
		coordinates: coordinates,
		vehicles,
		zoneId: 1
	};
};

const createVehicle = (id: number, events: Event[]): Vehicle => {
	return {
		id,
		capacities: { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 },
		events,
		availabilities: []
	};
};

const createEvent = (coordinates: Coordinates): Event => {
	return {
		capacities: { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 },
		is_pickup: true,
		time: new Interval(createDate(4), createDate(5)),
		id: 1,
		coordinates,
		tourId: 1,
		communicated: createDate(6),
		arrival: createDate(6),
		departure: createDate(3),
		durationFromPrev: 0,
		durationToNext: 0
	};
};

describe('compute Intervals for single insertions test', () => {
	it('TODO', () => {
		let eventLatLng = 70;
		let companyLatLng = 5;
		const companies = [
			createCompany(
				[
					createVehicle(1, [
						createEvent(new Coordinates(eventLatLng, eventLatLng++)),
						createEvent(new Coordinates(eventLatLng, eventLatLng++)),
						createEvent(new Coordinates(eventLatLng, eventLatLng++))
					])
				],
				new Coordinates(companyLatLng, companyLatLng++)
			)
		];
		const insertions = new Map<number, Range[]>();
		insertions.set(1, [{ earliestPickup: 0, latestDropoff: 3 }]);
		const travelDurations = [50];
		const routingResults: RoutingResults = {
			busStops: [
				{
					fromCompany: [{ duration: 10, distance: 0 }],
					toCompany: [{ duration: 10, distance: 0 }],
					fromPrevEvent: [
						{ duration: 10, distance: 0 },
						{ duration: 10, distance: 0 },
						{ duration: 10, distance: 0 }
					],
					toNextEvent: [
						{ duration: 10, distance: 0 },
						{ duration: 10, distance: 0 },
						{ duration: 10, distance: 0 }
					]
				}
			],
			userChosen: {
				fromCompany: [{ duration: 10, distance: 0 }],
				toCompany: [{ duration: 10, distance: 0 }],
				fromPrevEvent: [
					{ duration: 10, distance: 0 },
					{ duration: 10, distance: 0 },
					{ duration: 10, distance: 0 }
				],
				toNextEvent: [
					{ duration: 10, distance: 0 },
					{ duration: 10, distance: 0 },
					{ duration: 10, distance: 0 }
				]
			}
		};
		const busStopTimes = [[new Interval(createDate(5), createDate(6))]];
		const result = computeTravelDurations(
			companies,
			insertions,
			routingResults,
			travelDurations,
			true,
			busStopTimes,
			[[true]]
		);
		console.log(result);
		expect(1).toBe(1);
	});
});
