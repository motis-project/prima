import type { Event } from '$lib/compositionTypes';
import { Interval } from '$lib/interval';
import { Coordinates } from '$lib/location';
import { describe, it, expect } from 'vitest';
import type { Capacities } from '$lib/capacities';
import { capacitySimulation } from './capacitySimulation';

function createEventCapacitiesOnly(capacities: Capacities, is_pickup: boolean): Event {
	const now = new Date();
	return {
		capacities,
		is_pickup,
		time: new Interval(now, now),
		id: 1,
		coordinates: new Coordinates(1, 1),
		tourId: 1
	};
}

describe('capacity simulation test', () => {
	it('all valid, passengers', () => {
		const capacities = { wheelchairs: 0, bikes: 0, luggage: 0, passengers: 2 };
		const required = { wheelchairs: 0, bikes: 0, luggage: 0, passengers: 1 };
		const events = [
			createEventCapacitiesOnly({ passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }, true),
			createEventCapacitiesOnly({ passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }, false)
		];
		const ranges = capacitySimulation(capacities, required, events);
		expect(ranges).toHaveLength(1);
		expect(ranges[0].earliestPickup).toBe(0);
		expect(ranges[0].latestDropoff).toBe(2);
	});
	it('all valid, bikes', () => {
		const capacities = { wheelchairs: 0, bikes: 2, luggage: 0, passengers: 0 };
		const required = { wheelchairs: 0, bikes: 1, luggage: 0, passengers: 0 };
		const events = [
			createEventCapacitiesOnly({ passengers: 0, bikes: 1, wheelchairs: 0, luggage: 0 }, true),
			createEventCapacitiesOnly({ passengers: 0, bikes: 1, wheelchairs: 0, luggage: 0 }, false)
		];
		const ranges = capacitySimulation(capacities, required, events);
		expect(ranges).toHaveLength(1);
		expect(ranges[0].earliestPickup).toBe(0);
		expect(ranges[0].latestDropoff).toBe(2);
	});
	it('all valid, wheelchairs', () => {
		const capacities = { wheelchairs: 2, bikes: 0, luggage: 0, passengers: 0 };
		const required = { wheelchairs: 1, bikes: 0, luggage: 0, passengers: 0 };
		const events = [
			createEventCapacitiesOnly({ passengers: 0, bikes: 0, wheelchairs: 1, luggage: 0 }, true),
			createEventCapacitiesOnly({ passengers: 0, bikes: 0, wheelchairs: 1, luggage: 0 }, false)
		];
		const ranges = capacitySimulation(capacities, required, events);
		expect(ranges).toHaveLength(1);
		expect(ranges[0].earliestPickup).toBe(0);
		expect(ranges[0].latestDropoff).toBe(2);
	});
	it('all valid, luggage', () => {
		const capacities = { wheelchairs: 0, bikes: 0, luggage: 2, passengers: 0 };
		const required = { wheelchairs: 0, bikes: 0, luggage: 1, passengers: 0 };
		const events = [
			createEventCapacitiesOnly({ passengers: 0, bikes: 0, wheelchairs: 0, luggage: 1 }, true),
			createEventCapacitiesOnly({ passengers: 0, bikes: 0, wheelchairs: 0, luggage: 1 }, false)
		];
		const ranges = capacitySimulation(capacities, required, events);
		expect(ranges).toHaveLength(1);
		expect(ranges[0].earliestPickup).toBe(0);
		expect(ranges[0].latestDropoff).toBe(2);
	});
	it('all valid, luggage on seats', () => {
		const capacities = { wheelchairs: 0, bikes: 0, luggage: 0, passengers: 4 };
		const required = { wheelchairs: 0, bikes: 0, luggage: 1, passengers: 1 };
		const events = [
			createEventCapacitiesOnly({ passengers: 1, bikes: 0, wheelchairs: 0, luggage: 1 }, true),
			createEventCapacitiesOnly({ passengers: 1, bikes: 0, wheelchairs: 0, luggage: 1 }, false)
		];
		const ranges = capacitySimulation(capacities, required, events);
		expect(ranges).toHaveLength(1);
		expect(ranges[0].earliestPickup).toBe(0);
		expect(ranges[0].latestDropoff).toBe(2);
	});
	it('too many passengers', () => {
		const capacities = { wheelchairs: 0, bikes: 0, luggage: 0, passengers: 1 };
		const required = { wheelchairs: 0, bikes: 0, luggage: 0, passengers: 1 };
		const events = [
			createEventCapacitiesOnly({ passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }, true),
			createEventCapacitiesOnly({ passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }, false)
		];
		const ranges = capacitySimulation(capacities, required, events);
		expect(ranges).toHaveLength(2);
		expect(ranges[0].earliestPickup).toBe(0);
		expect(ranges[0].latestDropoff).toBe(0);
		expect(ranges[1].earliestPickup).toBe(2);
		expect(ranges[1].latestDropoff).toBe(2);
	});
	it('too many bikes', () => {
		const capacities = { wheelchairs: 0, bikes: 1, luggage: 0, passengers: 0 };
		const required = { wheelchairs: 0, bikes: 1, luggage: 0, passengers: 0 };
		const events = [
			createEventCapacitiesOnly({ passengers: 0, bikes: 1, wheelchairs: 0, luggage: 0 }, true),
			createEventCapacitiesOnly({ passengers: 0, bikes: 1, wheelchairs: 0, luggage: 0 }, false)
		];
		const ranges = capacitySimulation(capacities, required, events);
		expect(ranges).toHaveLength(2);
		expect(ranges[0].earliestPickup).toBe(0);
		expect(ranges[0].latestDropoff).toBe(0);
		expect(ranges[1].earliestPickup).toBe(2);
		expect(ranges[1].latestDropoff).toBe(2);
	});
	it('too many wheelchairs', () => {
		const capacities = { wheelchairs: 1, bikes: 0, luggage: 0, passengers: 0 };
		const required = { wheelchairs: 1, bikes: 0, luggage: 0, passengers: 0 };
		const events = [
			createEventCapacitiesOnly({ passengers: 0, bikes: 0, wheelchairs: 1, luggage: 0 }, true),
			createEventCapacitiesOnly({ passengers: 0, bikes: 0, wheelchairs: 1, luggage: 0 }, false)
		];
		const ranges = capacitySimulation(capacities, required, events);
		expect(ranges).toHaveLength(2);
		expect(ranges[0].earliestPickup).toBe(0);
		expect(ranges[0].latestDropoff).toBe(0);
		expect(ranges[1].earliestPickup).toBe(2);
		expect(ranges[1].latestDropoff).toBe(2);
	});
	it('too much luggage', () => {
		const capacities = { wheelchairs: 0, bikes: 0, luggage: 1, passengers: 0 };
		const required = { wheelchairs: 0, bikes: 0, luggage: 1, passengers: 0 };
		const events = [
			createEventCapacitiesOnly({ passengers: 0, bikes: 0, wheelchairs: 0, luggage: 1 }, true),
			createEventCapacitiesOnly({ passengers: 0, bikes: 0, wheelchairs: 0, luggage: 1 }, false)
		];
		const ranges = capacitySimulation(capacities, required, events);
		expect(ranges).toHaveLength(2);
		expect(ranges[0].earliestPickup).toBe(0);
		expect(ranges[0].latestDropoff).toBe(0);
		expect(ranges[1].earliestPickup).toBe(2);
		expect(ranges[1].latestDropoff).toBe(2);
	});
	it('too much luggage + passengers', () => {
		const capacities = { wheelchairs: 0, bikes: 0, luggage: 1, passengers: 2 };
		const required = { wheelchairs: 0, bikes: 0, luggage: 1, passengers: 1 };
		const events = [
			createEventCapacitiesOnly({ passengers: 1, bikes: 0, wheelchairs: 0, luggage: 1 }, true),
			createEventCapacitiesOnly({ passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }, false)
		];
		const ranges = capacitySimulation(capacities, required, events);
		expect(ranges).toHaveLength(2);
		expect(ranges[0].earliestPickup).toBe(0);
		expect(ranges[0].latestDropoff).toBe(0);
		expect(ranges[1].earliestPickup).toBe(2);
		expect(ranges[1].latestDropoff).toBe(2);
	});
	it('3 ranges', () => {
		const capacities = { wheelchairs: 0, bikes: 0, luggage: 0, passengers: 2 };
		const required = { wheelchairs: 0, bikes: 0, luggage: 0, passengers: 1 };
		const events = [
			createEventCapacitiesOnly({ passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }, true),
			createEventCapacitiesOnly({ passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }, true),
			createEventCapacitiesOnly({ passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }, false),
			createEventCapacitiesOnly({ passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }, true),
			createEventCapacitiesOnly({ passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }, false),
			createEventCapacitiesOnly({ passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }, false)
		];
		const ranges = capacitySimulation(capacities, required, events);
		expect(ranges).toHaveLength(3);
		expect(ranges[0].earliestPickup).toBe(0);
		expect(ranges[0].latestDropoff).toBe(1);
		expect(ranges[1].earliestPickup).toBe(3);
		expect(ranges[1].latestDropoff).toBe(3);
		expect(ranges[2].earliestPickup).toBe(5);
		expect(ranges[2].latestDropoff).toBe(6);
	});
});
