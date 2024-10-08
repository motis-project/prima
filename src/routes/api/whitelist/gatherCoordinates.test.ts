import { describe, it, expect } from 'vitest';
import { type Range } from './capacitySimulation';
import { Coordinates } from '$lib/location';
import type { Vehicle, Company, Event } from '$lib/compositionTypes';
import { gatherRoutingCoordinates } from './routing';
import { Interval } from '$lib/interval';

const createCompany = (vehicles: Vehicle[], coordinates: Coordinates): Company => {
	return {
		id: 1,
		coordinates: coordinates,
		vehicles,
		zoneId: 1
	};
};

const createVehicle = (events: Event[]): Vehicle => {
	return {
		id: 1,
		capacities: { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 },
		events,
		tours: [],
		availabilities: [],
		lastEventBefore: undefined,
		firstEventAfter: undefined
	};
};

const createEvent = (coordinates: Coordinates): Event => {
	return {
		capacities: { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 },
		is_pickup: true,
		id: 1,
		coordinates,
		tourId: 1,
		time: new Interval(new Date(), new Date())
	};
};

describe('gather coordinates test', () => {
	it('insertion only possible before first event', () => {
		let eventLatLng = 100;
		let companyLatLng = 5;
		const companies = [
			createCompany(
				[
					createVehicle([
						createEvent(new Coordinates(eventLatLng, eventLatLng++)),
						createEvent(new Coordinates(eventLatLng, eventLatLng++))
					])
				],
				new Coordinates(companyLatLng, companyLatLng++)
			)
		];
		const busStopCompanyFilter = [[true, true]];
		const insertions = new Map<number, Range[]>();
		insertions.set(1, [{ earliestPickup: 0, latestDropoff: 0 }]);
		const coordinates = gatherRoutingCoordinates(companies, insertions, busStopCompanyFilter);
		expect(coordinates.busStopBackwardMany).toHaveLength(2);
		expect(coordinates.busStopForwardMany).toHaveLength(2);
		expect(coordinates.userChosenBackwardMany).toHaveLength(1);
		expect(coordinates.userChosenForwardMany).toHaveLength(2);
		busStopCompanyFilter.forEach((_, idx) => {
			expect(coordinates.busStopBackwardMany[idx]).toHaveLength(1);
			expect(coordinates.busStopForwardMany[idx]).toHaveLength(2);
		});
		// company
		expect(coordinates.userChosenBackwardMany[0].lat).toBe(5);
		expect(coordinates.userChosenForwardMany[0].lat).toBe(5);
		expect(coordinates.busStopBackwardMany[0][0].lat).toBe(5);
		expect(coordinates.busStopForwardMany[0][0].lat).toBe(5);
		expect(coordinates.busStopBackwardMany[1][0].lat).toBe(5);
		expect(coordinates.busStopForwardMany[1][0].lat).toBe(5);

		// event
		expect(coordinates.userChosenBackwardMany[1]).toBe(undefined);
		expect(coordinates.userChosenForwardMany[1].lat).toBe(100);
		expect(coordinates.busStopBackwardMany[0][1]).toBe(undefined);
		expect(coordinates.busStopForwardMany[0][1].lat).toBe(100);
		expect(coordinates.busStopBackwardMany[1][1]).toBe(undefined);
		expect(coordinates.busStopForwardMany[1][1].lat).toBe(100);
	});
	it('insertion only possible after last event', () => {
		let eventLatLng = 100;
		let companyLatLng = 5;
		const companies = [
			createCompany(
				[
					createVehicle([
						createEvent(new Coordinates(eventLatLng, eventLatLng++)),
						createEvent(new Coordinates(eventLatLng, eventLatLng++))
					])
				],
				new Coordinates(companyLatLng, companyLatLng++)
			)
		];
		const busStopCompanyFilter = [[true, true]];
		const insertions = new Map<number, Range[]>();
		insertions.set(1, [{ earliestPickup: 2, latestDropoff: 2 }]);
		const coordinates = gatherRoutingCoordinates(companies, insertions, busStopCompanyFilter);
		expect(coordinates.busStopBackwardMany).toHaveLength(2);
		expect(coordinates.busStopForwardMany).toHaveLength(2);
		expect(coordinates.userChosenBackwardMany).toHaveLength(2);
		expect(coordinates.userChosenForwardMany).toHaveLength(1);
		busStopCompanyFilter.forEach((_, idx) => {
			expect(coordinates.busStopBackwardMany[idx]).toHaveLength(2);
			expect(coordinates.busStopForwardMany[idx]).toHaveLength(1);
		});
		// company
		expect(coordinates.userChosenBackwardMany[0].lat).toBe(5);
		expect(coordinates.userChosenForwardMany[0].lat).toBe(5);
		expect(coordinates.busStopBackwardMany[0][0].lat).toBe(5);
		expect(coordinates.busStopForwardMany[0][0].lat).toBe(5);
		expect(coordinates.busStopBackwardMany[1][0].lat).toBe(5);
		expect(coordinates.busStopForwardMany[1][0].lat).toBe(5);

		// event
		expect(coordinates.userChosenForwardMany[1]).toBe(undefined);
		expect(coordinates.userChosenBackwardMany[1].lat).toBe(101);
		expect(coordinates.busStopForwardMany[0][1]).toBe(undefined);
		expect(coordinates.busStopBackwardMany[0][1].lat).toBe(101);
		expect(coordinates.busStopForwardMany[1][1]).toBe(undefined);
		expect(coordinates.busStopBackwardMany[1][1].lat).toBe(101);
	});
	it('insertion only possible between events', () => {
		let eventLatLng = 100;
		let companyLatLng = 5;
		const companies = [
			createCompany(
				[
					createVehicle([
						createEvent(new Coordinates(eventLatLng, eventLatLng++)),
						createEvent(new Coordinates(eventLatLng, eventLatLng++))
					])
				],
				new Coordinates(companyLatLng, companyLatLng++)
			)
		];
		const busStopCompanyFilter = [[true, true]];
		const insertions = new Map<number, Range[]>();
		insertions.set(1, [{ earliestPickup: 1, latestDropoff: 1 }]);
		const coordinates = gatherRoutingCoordinates(companies, insertions, busStopCompanyFilter);
		expect(coordinates.busStopBackwardMany).toHaveLength(2);
		expect(coordinates.busStopForwardMany).toHaveLength(2);
		expect(coordinates.userChosenBackwardMany).toHaveLength(2);
		expect(coordinates.userChosenForwardMany).toHaveLength(2);
		busStopCompanyFilter.forEach((_, idx) => {
			expect(coordinates.busStopBackwardMany[idx]).toHaveLength(2);
			expect(coordinates.busStopForwardMany[idx]).toHaveLength(2);
		});
		// company
		expect(coordinates.userChosenBackwardMany[0].lat).toBe(5);
		expect(coordinates.userChosenForwardMany[0].lat).toBe(5);
		expect(coordinates.busStopBackwardMany[0][0].lat).toBe(5);
		expect(coordinates.busStopForwardMany[0][0].lat).toBe(5);
		expect(coordinates.busStopBackwardMany[1][0].lat).toBe(5);
		expect(coordinates.busStopForwardMany[1][0].lat).toBe(5);

		// event
		expect(coordinates.userChosenForwardMany[1].lat).toBe(101);
		expect(coordinates.userChosenBackwardMany[1].lat).toBe(100);
		expect(coordinates.busStopForwardMany[0][1].lat).toBe(101);
		expect(coordinates.busStopBackwardMany[0][1].lat).toBe(100);
		expect(coordinates.busStopForwardMany[1][1].lat).toBe(101);
		expect(coordinates.busStopBackwardMany[1][1].lat).toBe(100);
	});
	it('insertion not possible after last event', () => {
		let eventLatLng = 100;
		let companyLatLng = 5;
		const companies = [
			createCompany(
				[
					createVehicle([
						createEvent(new Coordinates(eventLatLng, eventLatLng++)),
						createEvent(new Coordinates(eventLatLng, eventLatLng++))
					])
				],
				new Coordinates(companyLatLng, companyLatLng++)
			)
		];
		const busStopCompanyFilter = [[true, true]];
		const insertions = new Map<number, Range[]>();
		insertions.set(1, [{ earliestPickup: 0, latestDropoff: 1 }]);
		const coordinates = gatherRoutingCoordinates(companies, insertions, busStopCompanyFilter);
		expect(coordinates.busStopBackwardMany).toHaveLength(2);
		expect(coordinates.busStopForwardMany).toHaveLength(2);
		expect(coordinates.userChosenBackwardMany).toHaveLength(2);
		expect(coordinates.userChosenForwardMany).toHaveLength(3);
		busStopCompanyFilter.forEach((_, idx) => {
			expect(coordinates.busStopBackwardMany[idx]).toHaveLength(2);
			expect(coordinates.busStopForwardMany[idx]).toHaveLength(3);
		});
		// company
		expect(coordinates.userChosenBackwardMany[0].lat).toBe(5);
		expect(coordinates.userChosenForwardMany[0].lat).toBe(5);
		expect(coordinates.busStopBackwardMany[0][0].lat).toBe(5);
		expect(coordinates.busStopForwardMany[0][0].lat).toBe(5);
		expect(coordinates.busStopBackwardMany[1][0].lat).toBe(5);
		expect(coordinates.busStopForwardMany[1][0].lat).toBe(5);

		// event
		expect(coordinates.userChosenForwardMany[1].lat).toBe(100);
		expect(coordinates.userChosenBackwardMany[1].lat).toBe(100);
		expect(coordinates.busStopForwardMany[0][1].lat).toBe(100);
		expect(coordinates.busStopBackwardMany[0][1].lat).toBe(100);
		expect(coordinates.busStopForwardMany[1][1].lat).toBe(100);
		expect(coordinates.busStopBackwardMany[1][1].lat).toBe(100);

		expect(coordinates.userChosenForwardMany[2].lat).toBe(101);
		expect(coordinates.userChosenBackwardMany[2]).toBe(undefined);
		expect(coordinates.busStopForwardMany[0][2].lat).toBe(101);
		expect(coordinates.busStopBackwardMany[0][2]).toBe(undefined);
		expect(coordinates.busStopForwardMany[1][2].lat).toBe(101);
		expect(coordinates.busStopBackwardMany[1][2]).toBe(undefined);
	});
	it('2companies, all insertions possible', () => {
		let eventLatLng = 100;
		let companyLatLng = 5;
		const companies = [
			createCompany(
				[
					createVehicle([
						createEvent(new Coordinates(eventLatLng, eventLatLng++)),
						createEvent(new Coordinates(eventLatLng, eventLatLng++))
					])
				],
				new Coordinates(companyLatLng, companyLatLng++)
			),
			createCompany(
				[
					createVehicle([
						createEvent(new Coordinates(eventLatLng, eventLatLng++)),
						createEvent(new Coordinates(eventLatLng, eventLatLng++))
					])
				],
				new Coordinates(companyLatLng, companyLatLng++)
			)
		];
		const busStopCompanyFilter = [
			[true, true],
			[true, true]
		];
		const insertions = new Map<number, Range[]>();
		insertions.set(1, [{ earliestPickup: 0, latestDropoff: 2 }]);
		insertions.set(2, [{ earliestPickup: 0, latestDropoff: 2 }]);
		const coordinates = gatherRoutingCoordinates(companies, insertions, busStopCompanyFilter);
		expect(coordinates.busStopBackwardMany).toHaveLength(2);
		expect(coordinates.busStopForwardMany).toHaveLength(2);
		expect(coordinates.userChosenBackwardMany).toHaveLength(6);
		expect(coordinates.userChosenForwardMany).toHaveLength(6);
		busStopCompanyFilter.forEach((_, idx) => {
			expect(coordinates.busStopBackwardMany[idx]).toHaveLength(6);
			expect(coordinates.busStopForwardMany[idx]).toHaveLength(6);
		});
		// Company coordinates
		expect(coordinates.userChosenBackwardMany[0].lat).toBe(5);
		expect(coordinates.userChosenForwardMany[0].lat).toBe(5);
		expect(coordinates.busStopBackwardMany[1][0].lat).toBe(5);
		expect(coordinates.busStopForwardMany[1][0].lat).toBe(5);
		expect(coordinates.busStopBackwardMany[0][0].lat).toBe(5);
		expect(coordinates.busStopForwardMany[0][0].lat).toBe(5);
		expect(coordinates.userChosenBackwardMany[1].lat).toBe(6);
		expect(coordinates.userChosenForwardMany[1].lat).toBe(6);
		expect(coordinates.busStopBackwardMany[0][1].lat).toBe(6);
		expect(coordinates.busStopForwardMany[0][1].lat).toBe(6);
		expect(coordinates.busStopBackwardMany[1][1].lat).toBe(6);
		expect(coordinates.busStopForwardMany[1][1].lat).toBe(6);

		// Event coordinates
		expect(coordinates.userChosenBackwardMany[2].lat).toBe(100);
		expect(coordinates.userChosenForwardMany[2].lat).toBe(100);
		expect(coordinates.busStopBackwardMany[0][2].lat).toBe(100);
		expect(coordinates.busStopForwardMany[0][2].lat).toBe(100);
		expect(coordinates.busStopBackwardMany[1][2].lat).toBe(100);
		expect(coordinates.busStopForwardMany[1][2].lat).toBe(100);

		expect(coordinates.userChosenBackwardMany[3].lat).toBe(101);
		expect(coordinates.userChosenForwardMany[3].lat).toBe(101);
		expect(coordinates.busStopBackwardMany[0][3].lat).toBe(101);
		expect(coordinates.busStopForwardMany[0][3].lat).toBe(101);
		expect(coordinates.busStopBackwardMany[1][3].lat).toBe(101);
		expect(coordinates.busStopForwardMany[1][3].lat).toBe(101);

		expect(coordinates.userChosenBackwardMany[4].lat).toBe(102);
		expect(coordinates.userChosenForwardMany[4].lat).toBe(102);
		expect(coordinates.busStopBackwardMany[0][4].lat).toBe(102);
		expect(coordinates.busStopForwardMany[0][4].lat).toBe(102);
		expect(coordinates.busStopBackwardMany[1][4].lat).toBe(102);
		expect(coordinates.busStopForwardMany[1][4].lat).toBe(102);

		expect(coordinates.userChosenBackwardMany[5].lat).toBe(103);
		expect(coordinates.userChosenForwardMany[5].lat).toBe(103);
		expect(coordinates.busStopBackwardMany[0][5].lat).toBe(103);
		expect(coordinates.busStopForwardMany[0][5].lat).toBe(103);
		expect(coordinates.busStopBackwardMany[1][5].lat).toBe(103);
		expect(coordinates.busStopForwardMany[1][5].lat).toBe(103);
	});
	it('2companies, 1 company-busstop combination filtered out', async () => {
		let eventLatLng = 100;
		let companyLatLng = 5;
		const companies = [
			createCompany(
				[
					createVehicle([
						createEvent(new Coordinates(eventLatLng, eventLatLng++)),
						createEvent(new Coordinates(eventLatLng, eventLatLng++))
					])
				],
				new Coordinates(companyLatLng, companyLatLng++)
			),
			createCompany(
				[
					createVehicle([
						createEvent(new Coordinates(eventLatLng, eventLatLng++)),
						createEvent(new Coordinates(eventLatLng, eventLatLng++))
					])
				],
				new Coordinates(companyLatLng, companyLatLng++)
			)
		];
		const busStopCompanyFilter = [
			[false, true],
			[true, true]
		];
		const insertions = new Map<number, Range[]>();
		insertions.set(1, [{ earliestPickup: 0, latestDropoff: 2 }]);
		insertions.set(2, [{ earliestPickup: 0, latestDropoff: 2 }]);
		const coordinates = gatherRoutingCoordinates(companies, insertions, busStopCompanyFilter);

		expect(coordinates.busStopBackwardMany).toHaveLength(2);
		expect(coordinates.busStopForwardMany).toHaveLength(2);
		expect(coordinates.userChosenBackwardMany).toHaveLength(6);
		expect(coordinates.userChosenForwardMany).toHaveLength(6);
		expect(coordinates.busStopBackwardMany[0]).toHaveLength(3);
		expect(coordinates.busStopForwardMany[0]).toHaveLength(3);
		expect(coordinates.busStopBackwardMany[1]).toHaveLength(6);
		expect(coordinates.busStopForwardMany[1]).toHaveLength(6);
		// Company coordinates
		expect(coordinates.userChosenBackwardMany[0].lat).toBe(5);
		expect(coordinates.userChosenForwardMany[0].lat).toBe(5);
		expect(coordinates.busStopBackwardMany[1][0].lat).toBe(5);
		expect(coordinates.busStopForwardMany[1][0].lat).toBe(5);
		expect(coordinates.busStopBackwardMany[0][0].lat).toBe(6);
		expect(coordinates.busStopForwardMany[0][0].lat).toBe(6);
		expect(coordinates.userChosenBackwardMany[1].lat).toBe(6);
		expect(coordinates.userChosenForwardMany[1].lat).toBe(6);
		expect(coordinates.busStopBackwardMany[1][1].lat).toBe(6);
		expect(coordinates.busStopForwardMany[1][1].lat).toBe(6);
		// Event coordinates
		expect(coordinates.userChosenBackwardMany[2].lat).toBe(100);
		expect(coordinates.userChosenForwardMany[2].lat).toBe(100);
		expect(coordinates.busStopBackwardMany[1][2].lat).toBe(100);
		expect(coordinates.busStopForwardMany[1][2].lat).toBe(100);

		expect(coordinates.userChosenBackwardMany[3].lat).toBe(101);
		expect(coordinates.userChosenForwardMany[3].lat).toBe(101);
		expect(coordinates.busStopBackwardMany[1][3].lat).toBe(101);
		expect(coordinates.busStopForwardMany[1][3].lat).toBe(101);

		expect(coordinates.userChosenBackwardMany[4].lat).toBe(102);
		expect(coordinates.userChosenForwardMany[4].lat).toBe(102);
		expect(coordinates.busStopBackwardMany[0][1].lat).toBe(102);
		expect(coordinates.busStopForwardMany[0][1].lat).toBe(102);
		expect(coordinates.busStopBackwardMany[1][4].lat).toBe(102);
		expect(coordinates.busStopForwardMany[1][4].lat).toBe(102);

		expect(coordinates.userChosenBackwardMany[5].lat).toBe(103);
		expect(coordinates.userChosenForwardMany[5].lat).toBe(103);
		expect(coordinates.busStopBackwardMany[0][2].lat).toBe(103);
		expect(coordinates.busStopForwardMany[0][2].lat).toBe(103);
		expect(coordinates.busStopBackwardMany[1][5].lat).toBe(103);
		expect(coordinates.busStopForwardMany[1][5].lat).toBe(103);
	});
	it('insertion only possible before first event, lastEventBefore exists', () => {
		let eventLatLng = 100;
		let companyLatLng = 5;
		const companies = [
			createCompany(
				[
					createVehicle([
						createEvent(new Coordinates(eventLatLng, eventLatLng++)),
						createEvent(new Coordinates(eventLatLng, eventLatLng++))
					])
				],
				new Coordinates(companyLatLng, companyLatLng++)
			)
		];
		companies[0].vehicles[0].lastEventBefore = createEvent(
			new Coordinates(eventLatLng, eventLatLng++)
		);
		const busStopCompanyFilter = [[true, true]];
		const insertions = new Map<number, Range[]>();
		insertions.set(1, [{ earliestPickup: 0, latestDropoff: 0 }]);
		const coordinates = gatherRoutingCoordinates(companies, insertions, busStopCompanyFilter);
		expect(coordinates.busStopBackwardMany).toHaveLength(2);
		expect(coordinates.busStopForwardMany).toHaveLength(2);
		expect(coordinates.userChosenBackwardMany).toHaveLength(2);
		expect(coordinates.userChosenForwardMany).toHaveLength(2);
		busStopCompanyFilter.forEach((_, idx) => {
			expect(coordinates.busStopBackwardMany[idx]).toHaveLength(2);
			expect(coordinates.busStopForwardMany[idx]).toHaveLength(2);
		});
		// company
		expect(coordinates.userChosenBackwardMany[0].lat).toBe(5);
		expect(coordinates.userChosenForwardMany[0].lat).toBe(5);
		expect(coordinates.busStopBackwardMany[0][0].lat).toBe(5);
		expect(coordinates.busStopForwardMany[0][0].lat).toBe(5);
		expect(coordinates.busStopBackwardMany[1][0].lat).toBe(5);
		expect(coordinates.busStopForwardMany[1][0].lat).toBe(5);

		// event
		expect(coordinates.userChosenBackwardMany[1].lat).toBe(102);
		expect(coordinates.userChosenForwardMany[1].lat).toBe(100);
		expect(coordinates.busStopBackwardMany[0][1].lat).toBe(102);
		expect(coordinates.busStopForwardMany[0][1].lat).toBe(100);
		expect(coordinates.busStopBackwardMany[1][1].lat).toBe(102);
		expect(coordinates.busStopForwardMany[1][1].lat).toBe(100);
	});
});
