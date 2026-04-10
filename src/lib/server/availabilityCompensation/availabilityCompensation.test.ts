import { addCompany, addTaxi, clearDatabase, Zone } from '$lib/testHelpers';
import { describe, it, beforeEach, expect, beforeAll, afterAll } from 'vitest';
import { vi } from 'vitest';
import { addAvailability } from '../addAvailability';
import {
	captureAvailabilityState,
	computeCompensation,
	getStartOfMonth
} from './availabilityCompensation';
import { db } from '../db';
import { DAY } from '$lib/util/time';
import { MAXIMUM_DAILY_AVAILABILITY } from '$lib/constants';

let company = -1;
let vehicle = -1;
beforeEach(async () => {
	await clearDatabase();
	company = await addCompany(Zone.WEIßWASSER, { lat: 0, lng: 0 });
	vehicle = await addTaxi(company, { passengers: 3, luggage: 0, wheelchairs: 0, bikes: 0 });
});

beforeAll(async () => {
	vi.useFakeTimers();
});

afterAll(async () => {
	vi.useRealTimers();
});

describe('capture availability state', () => {
	it('no availability', async () => {
		const mockDate = new Date('2024-01-01T00:00:00Z');
		vi.setSystemTime(mockDate);

		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(0);

		await computeCompensation(getStartOfMonth(mockDate), true);
		const compensations = await db.selectFrom('availabilityCompensation').selectAll().execute();

		expect(compensations).toHaveLength(1);
		expect(compensations[0].score).toBe(0);
	});
	it('1 day', async () => {
		const mockDate = new Date('2024-01-01T00:00:00Z');
		vi.setSystemTime(mockDate);

		await addAvailability(Date.now() + DAY, Date.now() + 2 * DAY, vehicle, company);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(MAXIMUM_DAILY_AVAILABILITY);

		await computeCompensation(getStartOfMonth(mockDate), true);
		const compensations = await db.selectFrom('availabilityCompensation').selectAll().execute();
		expect(compensations).toHaveLength(1);
		expect(compensations[0].score).toBe(1 / 14);
	});
	it('2 days', async () => {
		const mockDate = new Date('2024-01-01T00:00:00Z');
		vi.setSystemTime(mockDate);

		await addAvailability(Date.now() + DAY, Date.now() + 2 * DAY, vehicle, company);
		await addAvailability(Date.now() + 3 * DAY, Date.now() + 4 * DAY, vehicle, company);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(MAXIMUM_DAILY_AVAILABILITY * 2);

		await computeCompensation(getStartOfMonth(mockDate), true);
		const compensations = await db.selectFrom('availabilityCompensation').selectAll().execute();
		expect(compensations).toHaveLength(1);
		expect(compensations[0].score).toBe(1 / 7);
	});
	it('full availability', async () => {
		const mockDate = new Date('2024-01-01T00:00:00Z');
		vi.setSystemTime(mockDate);

		await addAvailability(Date.now(), Date.now() + 14 * DAY, vehicle, company);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(MAXIMUM_DAILY_AVAILABILITY * 14);
		expect(states[0].prefactor).toBe(1);

		await computeCompensation(getStartOfMonth(mockDate), true);
		const compensations = await db.selectFrom('availabilityCompensation').selectAll().execute();
		expect(compensations).toHaveLength(1);
		expect(compensations[0].score).toBe(1);
	});
});
