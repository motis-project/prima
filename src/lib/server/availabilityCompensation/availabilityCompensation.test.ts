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
import { DAY, HOUR, MINUTE } from '$lib/util/time';
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
	it('1 hour', async () => {
		const mockDate = new Date('2024-01-01T00:00:00Z');
		vi.setSystemTime(mockDate);

		await addAvailability(Date.now() + 5 * HOUR, Date.now() + 6 * HOUR, vehicle, company);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(MAXIMUM_DAILY_AVAILABILITY / 21);
		expect(states[0].prefactor).toBe(1);

		await computeCompensation(getStartOfMonth(mockDate), true);
		const compensations = await db.selectFrom('availabilityCompensation').selectAll().execute();
		expect(compensations).toHaveLength(1);
		expect(compensations[0].score).toBe(1 / 14 / 21);
	});
	it('1 block', async () => {
		const mockDate = new Date('2024-01-01T00:00:00Z');
		vi.setSystemTime(mockDate);

		await addAvailability(
			Date.now() + 5 * HOUR,
			Date.now() + 5 * HOUR + 15 * MINUTE,
			vehicle,
			company
		);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(MAXIMUM_DAILY_AVAILABILITY / 21 / 4);
		expect(states[0].prefactor).toBe(1);

		await computeCompensation(getStartOfMonth(mockDate), true);
		const compensations = await db.selectFrom('availabilityCompensation').selectAll().execute();
		expect(compensations).toHaveLength(1);
		expect(compensations[0].score).toBe(1 / 14 / 21 / 4);
	});
	it('touching 2 months', async () => {
		const mockDate = new Date('2024-01-31T00:00:00Z');
		vi.setSystemTime(mockDate);

		await addAvailability(Date.now(), Date.now() + 5 * DAY, vehicle, company);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(2);
		console.log({ states });
		expect(states[0].score).toBe(MAXIMUM_DAILY_AVAILABILITY);
		expect(states[0].prefactor).toBe(1 / 14);
		expect(states[1].score).toBe(MAXIMUM_DAILY_AVAILABILITY * 4);
		expect(states[1].prefactor).toBe(13 / 14);

		await computeCompensation(getStartOfMonth(mockDate), true);
		const compensations = await db.selectFrom('availabilityCompensation').selectAll().execute();
		expect(compensations).toHaveLength(1);
		expect(compensations[0].score).toBe(1);

		await computeCompensation(getStartOfMonth(new Date(mockDate.getTime() + DAY * 5)), true);
		const compensations2 = await db.selectFrom('availabilityCompensation').selectAll().execute();
		expect(compensations2).toHaveLength(2);
		expect(compensations2[1].score).toBe((14 / 13) * (2 / 7));
	});
	it('2 vehicles', async () => {
		const mockDate = new Date('2024-01-01T00:00:00Z');
		vi.setSystemTime(mockDate);
		const vehicle2 = await addTaxi(company, {
			passengers: 3,
			luggage: 0,
			wheelchairs: 0,
			bikes: 0
		});

		await addAvailability(Date.now(), Date.now() + 5 * DAY, vehicle, company);
		await addAvailability(Date.now() + 5 * DAY, Date.now() + 6 * DAY, vehicle2, company);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(MAXIMUM_DAILY_AVAILABILITY * 6);
		expect(states[0].prefactor).toBe(1);

		await computeCompensation(getStartOfMonth(mockDate), true);
		const compensations = await db.selectFrom('availabilityCompensation').selectAll().execute();
		expect(compensations).toHaveLength(1);
		expect(compensations[0].score).toBe(3 / 7);
	});
	it('availability stretching outside 2-week-window', async () => {
		const mockDate = new Date('2024-01-01T00:00:00Z');
		vi.setSystemTime(mockDate);
		await addAvailability(Date.now(), Date.now() + DAY, vehicle, company);

		const mockDate2 = new Date('2024-01-01T11:00:00Z');
		vi.setSystemTime(mockDate2);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(12 * HOUR);
		expect(states[0].prefactor).toBe(1);

		await computeCompensation(getStartOfMonth(mockDate), true);
		const compensations = await db.selectFrom('availabilityCompensation').selectAll().execute();
		expect(compensations).toHaveLength(1);
		expect(compensations[0].score).toBe(12 / 14 / 21);
	});
	it('touching 2 months full 2 weeks made available', async () => {
		const mockDate = new Date('2024-01-31T00:00:00Z');
		vi.setSystemTime(mockDate);
		await addAvailability(Date.now(), Date.now() + 14 * DAY, vehicle, company);
		await captureAvailabilityState();

		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(2);
		expect(states[0].score).toBe(MAXIMUM_DAILY_AVAILABILITY);
		expect(states[0].prefactor).toBe(1 / 14);

		await computeCompensation(getStartOfMonth(mockDate), true);
		await computeCompensation(getStartOfMonth(new Date(mockDate.getTime() + 5 * DAY)), true);
		const compensations = await db.selectFrom('availabilityCompensation').selectAll().execute();
		expect(compensations).toHaveLength(2);
		expect(compensations[0].score).toBe(1);
		expect(compensations[1].score).toBe(1);
	});
});
