import { beforeEach, describe, expect, it } from 'vitest';
import {
	addCompany,
	addTaxi,
	addTestUser,
	clearDatabase,
	setAvailability,
	setEvent,
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
const now = new Date(Date.now());
const getMidnight = (t: Date) => {
	return Math.floor(t.getTime() / DAY) * DAY;
};
const midnight = getMidnight(now);
const testDays = [midnight - 30 * DAY];

describe('test accounting', () => {
	it('empty db', async () => {
		const { companyCostsPerDay } = await getCompanyCosts();
		expect(companyCostsPerDay).toHaveLength(0);
	});
	it('no customer', async () => {
		const c1 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		await setAvailability(v1, testDays[0] + HOUR * 5, testDays[0] + HOUR * 6);
		await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 1000);
		const { companyCostsPerDay } = await getCompanyCosts();
		expect(companyCostsPerDay).toHaveLength(1);
		expect(companyCostsPerDay[0].taxameter).toBe(1000);
		expect(companyCostsPerDay[0].capped).toBe(1000);
		expect(companyCostsPerDay[0].uncapped).toBe(1000);
		expect(companyCostsPerDay[0].customerCount).toBe(0);
	});

	it('one customer', async () => {
		const u = await addTestUser();
		const c1 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		await setAvailability(v1, testDays[0] + HOUR * 5, testDays[0] + HOUR * 6);
		const t1 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 1000))!.id;
		const r1 = await setRequest(t1, u.id, '');
		await setEvent(r1.id, 1, true, 1, 1);
		const { companyCostsPerDay } = await getCompanyCosts();
		expect(companyCostsPerDay).toHaveLength(1);
		expect(companyCostsPerDay[0].taxameter).toBe(1000);
		expect(companyCostsPerDay[0].uncapped).toBe(400);
		expect(companyCostsPerDay[0].capped).toBe(400);
		expect(companyCostsPerDay[0].customerCount).toBe(1);
		expect(companyCostsPerDay[0].availabilityDuration).toBe(HOUR);
	});

	it('two customers', async () => {
		const u = await addTestUser();
		const c1 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		await setAvailability(v1, testDays[0] + HOUR * 5, testDays[0] + HOUR * 6);
		const t1 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 1000))!.id;
		const r1 = await setRequest(t1, u.id, '');
		const r2 = await setRequest(t1, u.id, '');
		await setEvent(r1.id, 1, true, 1, 1);
		await setEvent(r2.id, 1, true, 1, 1);
		const { companyCostsPerDay } = await getCompanyCosts();
		expect(companyCostsPerDay).toHaveLength(1);
		expect(companyCostsPerDay[0].taxameter).toBe(1000);
		expect(companyCostsPerDay[0].uncapped).toBe(-200);
		expect(companyCostsPerDay[0].capped).toBe(-200);
		expect(companyCostsPerDay[0].customerCount).toBe(2);
		expect(companyCostsPerDay[0].availabilityDuration).toBe(HOUR);
	});

	it('cap reached', async () => {
		const u = await addTestUser();
		const c1 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		await setAvailability(v1, testDays[0] + HOUR * 5, testDays[0] + HOUR * 6);
		const t1 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 5000))!.id;
		const r1 = await setRequest(t1, u.id, '');
		await setEvent(r1.id, 1, true, 1, 1);
		const { companyCostsPerDay } = await getCompanyCosts();
		expect(companyCostsPerDay).toHaveLength(1);
		expect(companyCostsPerDay[0].taxameter).toBe(5000);
		expect(companyCostsPerDay[0].uncapped).toBe(4400);
		expect(companyCostsPerDay[0].capped).toBe(3725);
		expect(companyCostsPerDay[0].customerCount).toBe(1);
		expect(companyCostsPerDay[0].availabilityDuration).toBe(HOUR);
	});

	it('two tours on same day - cap reached', async () => {
		const u = await addTestUser();
		const c1 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		await setAvailability(v1, testDays[0] + HOUR * 5, testDays[0] + HOUR * 6);
		const t1 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 2200))!.id;
		const t2 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 3400))!.id;
		const r1 = await setRequest(t1, u.id, '');
		await setEvent(r1.id, 1, true, 1, 1);
		const r2 = await setRequest(t2, u.id, '');
		await setEvent(r2.id, 1, true, 1, 1);
		const { companyCostsPerDay } = await getCompanyCosts();
		expect(companyCostsPerDay).toHaveLength(1);
		expect(companyCostsPerDay[0].taxameter).toBe(5600);
		expect(companyCostsPerDay[0].uncapped).toBe(4400);
		expect(companyCostsPerDay[0].capped).toBe(3725);
		expect(companyCostsPerDay[0].customerCount).toBe(2);
		expect(companyCostsPerDay[0].availabilityDuration).toBe(HOUR);
	});

	it('two tours and two availabilities on same day', async () => {
		// two availabilities totalling 70 minutes
		// 44€ uncapped price
		// capped price: 40 5/6 + (3 1/6) * .25 = 41.625
		const u = await addTestUser();
		const c1 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		await setAvailability(v1, testDays[0] + HOUR * 5, testDays[0] + HOUR * 6);
		await setAvailability(v1, testDays[0] + HOUR * 14, testDays[0] + HOUR * 14 + 10 * MINUTE);
		const t1 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 2200))!.id;
		const t2 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 3400))!.id;
		const r1 = await setRequest(t1, u.id, '');
		await setEvent(r1.id, 1, true, 1, 1);
		const r2 = await setRequest(t2, u.id, '');
		await setEvent(r2.id, 1, true, 1, 1);
		const { companyCostsPerDay } = await getCompanyCosts();
		expect(companyCostsPerDay).toHaveLength(1);
		expect(companyCostsPerDay[0].taxameter).toBe(5600);
		expect(companyCostsPerDay[0].uncapped).toBe(4400);
		expect(companyCostsPerDay[0].capped).toBe(4162.5);
		expect(companyCostsPerDay[0].customerCount).toBe(2);
		expect(companyCostsPerDay[0].availabilityDuration).toBe(70 * MINUTE);
	});

	it('availabilitiy crosses midnight', async () => {
		const u = await addTestUser();
		const c1 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		await setAvailability(v1, testDays[0] - 30 * DAY - 30 * MINUTE, testDays[0] + 30 * MINUTE);
		const t1 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 2630))!.id;
		const r1 = await setRequest(t1, u.id, '');
		await setEvent(r1.id, 1, true, 1, 1);
		const { companyCostsPerDay } = await getCompanyCosts();
		expect(companyCostsPerDay).toHaveLength(1);
		expect(companyCostsPerDay[0].taxameter).toBe(2630);
		expect(companyCostsPerDay[0].uncapped).toBe(2030);
		expect(companyCostsPerDay[0].capped).toBe(1820);
		expect(companyCostsPerDay[0].customerCount).toBe(1);
		expect(companyCostsPerDay[0].availabilityDuration).toBe(30 * MINUTE);
	});

	it('availabilitiy on insignificant day', async () => {
		const u = await addTestUser();
		const c1 = await addCompany(1, dummyCoordinates);
		const v1 = await addTaxi(c1, dummyCapacities);
		await setAvailability(v1, midnight + 30 * MINUTE, midnight + 90 * MINUTE);
		const t1 = (await setTour(v1, testDays[0] + HOUR, testDays[0] + HOUR * 2, 2600))!.id;
		const r1 = await setRequest(t1, u.id, '');
		await setEvent(r1.id, 1, true, 1, 1);
		const { companyCostsPerDay } = await getCompanyCosts();
		expect(companyCostsPerDay).toHaveLength(1);
		expect(companyCostsPerDay[0].taxameter).toBe(2600);
		expect(companyCostsPerDay[0].uncapped).toBe(2000);
		expect(companyCostsPerDay[0].capped).toBe(500);
		expect(companyCostsPerDay[0].availabilityDuration).toBe(0);
		expect(companyCostsPerDay[0].customerCount).toBe(1);
	});
});
