import { describe, it, expect } from 'vitest';
import { type Range } from './capacitySimulation';
import { Coordinates } from '$lib/location';
import type { Vehicle, Company, Tour, Event } from '$lib/compositionTypes';
import { Interval } from '$lib/interval';
import { gatherRoutingCoordinates } from './routing';

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

const createEvent = (coordinates: Coordinates): Event => {
	return {
		capacities: { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 },
		is_pickup: true,
		time: new Interval(new Date(), new Date()),
		id: 1,
		coordinates,
		tourId: 1
	};
};

const createBusStop = () => {
	return { coordinates: new Coordinates(1, 1), times: [] };
};

describe('gather coordinates test', () => {
	it('TODO', () => {
		let eventLatLng = 100;
		let companyLatLng = 5;
		const companies = [
			createCompany(
				[
					createVehicle(1, [
						createTour([
							createEvent(new Coordinates(eventLatLng, eventLatLng++)),
							createEvent(new Coordinates(eventLatLng, eventLatLng++))
						])
					])
				],
				new Coordinates(companyLatLng, companyLatLng++)
			),
			createCompany(
				[
					createVehicle(2, [
						createTour([
							createEvent(new Coordinates(eventLatLng, eventLatLng++)),
							createEvent(new Coordinates(eventLatLng, eventLatLng++))
						])
					])
				],
				new Coordinates(companyLatLng, companyLatLng++)
			)
		];
		const busStops = [createBusStop(), createBusStop()];
		const insertions = new Map<number, Range[]>();
		insertions.set(1, [{ earliestPickup: 0, latestDropoff: 2 }]);
		insertions.set(2, [{ earliestPickup: 0, latestDropoff: 2 }]);
		const coordinates = gatherRoutingCoordinates(companies, busStops, insertions);
		expect(coordinates.busStopMany).toHaveLength(2);
		expect(coordinates.userChosenMany).toHaveLength(18);
		busStops.forEach((_, idx) => {
			expect(coordinates.busStopMany[idx]).toHaveLength(18);
		});
	});
});
