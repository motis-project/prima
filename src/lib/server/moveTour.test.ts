import {
	addCompany,
	addTaxi,
	addTestUser,
	clearDatabase,
	setEvent,
	setRequest,
	setTour,
	Zone
} from '$lib/testHelpers';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { moveTour } from './moveTour';
import { HOUR } from '$lib/util/time';

beforeEach(async () => {
	await clearDatabase();
}, 60000);

const inNiesky1 = { lat: 51.29468377345111, lng: 14.833542206420248 };
const inNiesky2 = { lat: 51.29544187321241, lng: 14.820560314788537 };

const capacities = { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 };
const departure = Date.now() + 2 * HOUR;
const arrival = departure + HOUR;

const getTourVehicle = async (tourId: number) =>
	(
		await db
			.selectFrom('tour')
			.where('tour.id', '=', tourId)
			.select('tour.vehicle')
			.executeTakeFirstOrThrow()
	).vehicle;

const createTour = async (vehicle: number, customer: number) => {
	const tour = await setTour(vehicle, departure, arrival);
	const request = (await setRequest(tour!.id, customer, '')).id;
	await setEvent(request, departure, true, inNiesky1.lat, inNiesky1.lng);
	await setEvent(request, arrival, false, inNiesky2.lat, inNiesky2.lng);
	return tour!.id;
};

describe('tests for moving tours between vehicles', () => {
	it('moves a tour to another vehicle of the same company', async () => {
		const customer = (await addTestUser()).id;
		const company = await addCompany(Zone.NIESKY, inNiesky1);
		const vehicle1 = await addTaxi(company, capacities);
		const vehicle2 = await addTaxi(company, capacities);
		const tour = await createTour(vehicle1, customer);

		const result = await moveTour(tour, vehicle2, company);

		expect(result.status).toBe(200);
		expect(await getTourVehicle(tour)).toBe(vehicle2);
	});

	it('does not move a tour to a vehicle of a different company', async () => {
		const customer = (await addTestUser()).id;
		const ownCompany = await addCompany(Zone.NIESKY, inNiesky1);
		const foreignCompany = await addCompany(Zone.NIESKY, inNiesky2);
		const ownVehicle = await addTaxi(ownCompany, capacities);
		const foreignVehicle = await addTaxi(foreignCompany, capacities);
		const tour = await createTour(ownVehicle, customer);

		const result = await moveTour(tour, foreignVehicle, ownCompany);

		expect(result.status).toBe(400);
		expect(await getTourVehicle(tour)).toBe(ownVehicle);
	});
});
