import { beforeEach, describe, expect, it } from 'vitest';
import {
	addCompany,
	addTaxi,
	addTestUser,
	clearDatabase,
	setAvailability,
	setRequest,
	setTour
} from '$lib/testHelpers';
import { getCompanyCosts } from './getCompanyCosts';
import { DAY, HOUR, MINUTE } from '$lib/util/time';

beforeEach(async () => {
	await clearDatabase();
});

const dummyCoordinates = { lat: 1, lng: 1 };
const dummyCapacities = { passengers: 1, bikes: 1, wheelchairs: 1, luggage: 1 };
const midnight = Math.floor(Date.now() / DAY) * DAY;
const testDays = [midnight - 30 * DAY];

describe('test accounting', () => {
	it('empty db', async () => {
		const { costPerDayAndVehicle } = await getCompanyCosts();
		expect(costPerDayAndVehicle).toHaveLength(0);
	});
	it('no customer', async () => {
		const c1 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		await setAvailability(v1, testDays[0] + HOUR * 5, testDays[0] + HOUR * 6);
		await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 1000);
		const { costPerDayAndVehicle } = await getCompanyCosts();
		expect(costPerDayAndVehicle).toHaveLength(1);
		expect(costPerDayAndVehicle[0].taxameter).toBe(1000);
		expect(costPerDayAndVehicle[0].capped).toBe(1000);
		expect(costPerDayAndVehicle[0].uncapped).toBe(1000);
		expect(costPerDayAndVehicle[0].customerCount).toBe(0);
	});

	it('one customer', async () => {
		const u = await addTestUser();
		const c1 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		await setAvailability(v1, testDays[0] + HOUR * 5, testDays[0] + HOUR * 6);
		const t1 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 1000))!.id;
		await setRequest(t1, u.id, '', 1, true);
		const { costPerDayAndVehicle } = await getCompanyCosts();
		expect(costPerDayAndVehicle).toHaveLength(1);
		expect(costPerDayAndVehicle[0].taxameter).toBe(1000);
		expect(costPerDayAndVehicle[0].uncapped).toBe(700);
		expect(costPerDayAndVehicle[0].capped).toBe(700);
		expect(costPerDayAndVehicle[0].customerCount).toBe(1);
		expect(costPerDayAndVehicle[0].availabilityDuration).toBe(HOUR);
	});

	it('two customers', async () => {
		const u = await addTestUser();
		const c1 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		await setAvailability(v1, testDays[0] + HOUR * 5, testDays[0] + HOUR * 6);
		const t1 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 400))!.id;
		await setRequest(t1, u.id, '', 1, true);
		await setRequest(t1, u.id, '', 1, true);
		const { costPerDayAndVehicle } = await getCompanyCosts();
		expect(costPerDayAndVehicle).toHaveLength(1);
		expect(costPerDayAndVehicle[0].taxameter).toBe(400);
		expect(costPerDayAndVehicle[0].uncapped).toBe(-200);
		expect(costPerDayAndVehicle[0].capped).toBe(-200);
		expect(costPerDayAndVehicle[0].customerCount).toBe(2);
		expect(costPerDayAndVehicle[0].availabilityDuration).toBe(HOUR);
	});

	it('cap reached', async () => {
		const u = await addTestUser();
		const c1 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		await setAvailability(v1, testDays[0] + HOUR * 5, testDays[0] + HOUR * 6);
		const t1 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 5000))!.id;
		await setRequest(t1, u.id, '', 1, true);
		const { costPerDayAndVehicle } = await getCompanyCosts();
		expect(costPerDayAndVehicle).toHaveLength(1);
		expect(costPerDayAndVehicle[0].taxameter).toBe(5000);
		expect(costPerDayAndVehicle[0].uncapped).toBe(4700);
		expect(costPerDayAndVehicle[0].capped).toBe(3800);
		expect(costPerDayAndVehicle[0].customerCount).toBe(1);
		expect(costPerDayAndVehicle[0].availabilityDuration).toBe(HOUR);
	});

	it('two tours on same day - cap reached', async () => {
		const u = await addTestUser();
		const c1 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		await setAvailability(v1, testDays[0] + HOUR * 5, testDays[0] + HOUR * 6);
		const t1 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 2200))!.id;
		const t2 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 3400))!.id;
		await setRequest(t1, u.id, '', 1, true);
		await setRequest(t2, u.id, '', 1, true);
		const { costPerDayAndVehicle } = await getCompanyCosts();
		expect(costPerDayAndVehicle).toHaveLength(1);
		expect(costPerDayAndVehicle[0].taxameter).toBe(5600);
		expect(costPerDayAndVehicle[0].uncapped).toBe(5000);
		expect(costPerDayAndVehicle[0].capped).toBe(3875);
		expect(costPerDayAndVehicle[0].customerCount).toBe(2);
		expect(costPerDayAndVehicle[0].availabilityDuration).toBe(HOUR);
	});

	it('two tours and two availabilities on same day', async () => {
		// two availabilities totalling 70 minutes
		// 44€ uncapped price
		// capped price: 40 5/6 + (3 1/6) * .25 = 41.625
		const u = await addTestUser();
		const c1 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		await setAvailability(v1, testDays[0] + HOUR * 5, testDays[0] + HOUR * 6);
		await setAvailability(v1, testDays[0] + HOUR * 14, testDays[0] + HOUR * 14 + 30 * MINUTE);
		const t1 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 4250))!.id;
		const t2 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 3400))!.id;
		await setRequest(t1, u.id, '', 1, true);
		await setRequest(t2, u.id, '', 1, true);
		const { costPerDayAndVehicle } = await getCompanyCosts();
		expect(costPerDayAndVehicle).toHaveLength(1);
		expect(costPerDayAndVehicle[0].taxameter).toBe(7650);
		expect(costPerDayAndVehicle[0].uncapped).toBe(7050);
		expect(costPerDayAndVehicle[0].capped).toBe(5700);
		expect(costPerDayAndVehicle[0].customerCount).toBe(2);
		expect(costPerDayAndVehicle[0].availabilityDuration).toBe(90 * MINUTE);
	});

	it('availabilitiy on insignificant day', async () => {
		const u = await addTestUser();
		const c1 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		await setAvailability(v1, midnight + 30 * MINUTE, midnight + 90 * MINUTE);
		const t1 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 2600))!.id;
		await setRequest(t1, u.id, '', 1, true);
		const { costPerDayAndVehicle } = await getCompanyCosts();
		expect(costPerDayAndVehicle).toHaveLength(1);
		expect(costPerDayAndVehicle[0].taxameter).toBe(2600);
		expect(costPerDayAndVehicle[0].uncapped).toBe(2300);
		expect(costPerDayAndVehicle[0].capped).toBe(575);
		expect(costPerDayAndVehicle[0].availabilityDuration).toBe(0);
		expect(costPerDayAndVehicle[0].customerCount).toBe(1);
	});

	it('two tours same vehicle', async () => {
		const u = await addTestUser();
		const c1 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		const t1 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 2600))!.id;
		const t2 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 3000))!.id;
		await setRequest(t1, u.id, '', 1, true);
		await setRequest(t2, u.id, '', 1, true);
		const { costPerDayAndVehicle } = await getCompanyCosts();
		expect(costPerDayAndVehicle).toHaveLength(1);
		expect(costPerDayAndVehicle[0].taxameter).toBe(5600);
		expect(costPerDayAndVehicle[0].uncapped).toBe(5000);
		expect(costPerDayAndVehicle[0].capped).toBe(1250);
		expect(costPerDayAndVehicle[0].availabilityDuration).toBe(0);
		expect(costPerDayAndVehicle[0].customerCount).toBe(2);
	});

	it('two tours different vehicles', async () => {
		const u = await addTestUser();
		const c1 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		const v2 = await addTaxi(c1, dummyCapacities);
		await setAvailability(v1, testDays[0] + 3 * HOUR, testDays[0] + 4 * HOUR);
		await setAvailability(v2, testDays[0] + 3 * HOUR, testDays[0] + 4 * HOUR);
		const t1 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 5100))!.id;
		const t2 = (await setTour(v2, testDays[0] + HOUR, testDays[0] + HOUR * 2, 5100))!.id;
		await setRequest(t1, u.id, '', 1, true);
		await setRequest(t2, u.id, '', 1, true);
		const { costPerDayAndVehicle } = await getCompanyCosts();
		expect(costPerDayAndVehicle).toHaveLength(1);
		expect(costPerDayAndVehicle[0].taxameter).toBe(10200);
		expect(costPerDayAndVehicle[0].uncapped).toBe(9600);
		expect(costPerDayAndVehicle[0].capped).toBe(7650);
		expect(costPerDayAndVehicle[0].availabilityDuration).toBe(2 * HOUR);
		expect(costPerDayAndVehicle[0].customerCount).toBe(2);
	});

	it('tours with 2 customers', async () => {
		const u = await addTestUser();
		const c1 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		await setAvailability(v1, testDays[0] + 3 * HOUR, testDays[0] + 4 * HOUR);
		const t1 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 5700))!.id;
		await setRequest(t1, u.id, '', 2, true);
		const { costPerDayAndVehicle } = await getCompanyCosts();
		expect(costPerDayAndVehicle).toHaveLength(1);
		expect(costPerDayAndVehicle[0].taxameter).toBe(5700);
		expect(costPerDayAndVehicle[0].uncapped).toBe(5100);
		expect(costPerDayAndVehicle[0].capped).toBe(3900);
		expect(costPerDayAndVehicle[0].availabilityDuration).toBe(HOUR);
		expect(costPerDayAndVehicle[0].customerCount).toBe(2);
	});

	it('overlapping availabilities', async () => {
		const u = await addTestUser();
		const c1 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		const v2 = await addTaxi(c1, dummyCapacities);
		await setAvailability(v1, testDays[0] + 3 * HOUR, testDays[0] + 6 * HOUR);
		await setAvailability(v2, testDays[0] + 2 * HOUR, testDays[0] + 4 * HOUR);
		await setAvailability(v2, testDays[0] + 5 * HOUR, testDays[0] + 7 * HOUR);
		const t1 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 5100))!.id;
		const t2 = (await setTour(v2, testDays[0] + HOUR, testDays[0] + HOUR * 2, 35300))!.id;
		await setRequest(t1, u.id, '', 1, true);
		await setRequest(t2, u.id, '', 1, true);
		const { costPerDayAndVehicle } = await getCompanyCosts();
		expect(costPerDayAndVehicle).toHaveLength(1);
		expect(costPerDayAndVehicle[0].taxameter).toBe(40400);
		expect(costPerDayAndVehicle[0].uncapped).toBe(39800);
		expect(costPerDayAndVehicle[0].capped).toBe(24050);
		expect(costPerDayAndVehicle[0].availabilityDuration).toBe(7 * HOUR);
		expect(costPerDayAndVehicle[0].customerCount).toBe(2);
	});

	it('2 companies', async () => {
		const u = await addTestUser();
		const c1 = await addCompany(1, dummyCoordinates);
		const c2 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		const v2 = await addTaxi(c2, dummyCapacities);
		await setAvailability(v1, testDays[0] + 3 * HOUR, testDays[0] + 4 * HOUR);
		await setAvailability(v2, testDays[0] + 2 * HOUR, testDays[0] + 4 * HOUR);
		const t1 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 5100))!.id;
		const t2 = (await setTour(v2, testDays[0] + HOUR, testDays[0] + HOUR * 2, 9200))!.id;
		await setRequest(t1, u.id, '', 1, true);
		await setRequest(t2, u.id, '', 2, true);
		const { costPerDayAndVehicle } = await getCompanyCosts();
		expect(costPerDayAndVehicle).toHaveLength(2);
		expect(costPerDayAndVehicle[0].timestamp).toBe(costPerDayAndVehicle[1].timestamp);
		costPerDayAndVehicle.sort((c1, c2) => c1.companyId - c2.companyId);

		expect(costPerDayAndVehicle[0].taxameter).toBe(5100);
		expect(costPerDayAndVehicle[0].uncapped).toBe(4800);
		expect(costPerDayAndVehicle[0].capped).toBe(3825);
		expect(costPerDayAndVehicle[0].availabilityDuration).toBe(HOUR);
		expect(costPerDayAndVehicle[0].customerCount).toBe(1);

		expect(costPerDayAndVehicle[1].taxameter).toBe(9200);
		expect(costPerDayAndVehicle[1].uncapped).toBe(8600);
		expect(costPerDayAndVehicle[1].capped).toBe(7400);
		expect(costPerDayAndVehicle[1].availabilityDuration).toBe(2 * HOUR);
		expect(costPerDayAndVehicle[1].customerCount).toBe(2);
	});
});
