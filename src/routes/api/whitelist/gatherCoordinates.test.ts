import { describe, it, expect } from 'vitest';
import { capacitySimulation } from './capacitySimulation';
import type { BusStop } from '$lib/busStop';
import { hoursToMs } from '$lib/time_utils';
import { Coordinates } from '$lib/location';
import type { Vehicle, Company, Tour, Event } from '$lib/compositionTypes';
import type { Interval } from '$lib/interval';

const baseTime = new Date(Date.now() + hoursToMs(500));

const createBusStops = (timeShifts: number[][]): BusStop[] => {
	return timeShifts.map((shifts) => {
		return {
			coordinates: new Coordinates(1, 1),
			times: shifts.map((shift) => new Date(baseTime.getTime() + shift))
		};
	});
};

const createCompany = (vehicles: Vehicle[], coordinates: Coordinates): Company => {
	return {
		id: 1,
		coordinates: coordinates,
		vehicles,
		zoneId: 1
	};
};

const createVehicle = (id: number, tours: Tour[]): Vehicle => {
	return {
		id,
		capacities: { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 },
		tours,
		availabilities: []
	};
};

const createTour = (events: Event[]): Tour => {
	return {
		departure: new Date(),
		arrival: new Date(),
		id: 1,
		events
	};
};

const createEvent = (coordinates: Coordinates, time: Interval): Event => {
	return {
		capacities: { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 },
		is_pickup: true,
		time,
		id: 1,
		coordinates,
		tourId: 1
	};
};

describe('capacity simulation test', () => {
	it('all valid, passengers', () => {
		const companies = { wheelchairs: 0, bikes: 0, luggage: 0, passengers: 2 };
		const insertions = { wheelchairs: 0, bikes: 0, luggage: 0, passengers: 1 };
		const busStops = [createBusStops([[50]])];
		const ranges = capacitySimulation(capacities, required, events);
		expect(ranges).toHaveLength(1);
		expect(ranges[0].earliestPickup).toBe(0);
		expect(ranges[0].latestDropoff).toBe(2);
	});
});
