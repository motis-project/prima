import { addCompany, addTaxi, clearDatabase, Zone } from '$lib/testHelpers';
import { describe, it, beforeEach, expect, beforeAll, afterAll } from 'vitest';
import { vi } from 'vitest';
import { addAvailability } from '../addAvailability';
import {
	captureAvailabilityState,
	computeCompensation,
	getSnapshot,
	getStartOfMonth
} from './availabilityCompensation';
import { db } from '../db';
import { DAY, HOUR, MINUTE } from '$lib/util/time';
import {
	AVAILABILITY_CONFIRMATION_DEADLINE_DAYS,
	MAXIMUM_AVAILABILITY_IN_CONFIRMATION_DEADLINE,
	MAXIMUM_DAILY_AVAILABILITY
} from '$lib/constants';
import { deleteAvailability } from '../deleteAvailability';

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
		const mockDate = new Date('2024-01-01T00:00:00');
		vi.setSystemTime(mockDate);

		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(0);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));

		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(0);
	});
	it('1 day', async () => {
		const mockDate = new Date('2024-01-01T00:00:00');
		vi.setSystemTime(mockDate);

		await addAvailability(Date.now() + DAY, Date.now() + 2 * DAY, vehicle, company);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(MAXIMUM_DAILY_AVAILABILITY);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(1 / AVAILABILITY_CONFIRMATION_DEADLINE_DAYS);
	});
	it('2 days', async () => {
		const mockDate = new Date('2024-01-01T00:00:00');
		vi.setSystemTime(mockDate);

		await addAvailability(Date.now() + DAY, Date.now() + 2 * DAY, vehicle, company);
		await addAvailability(Date.now() + 3 * DAY, Date.now() + 4 * DAY, vehicle, company);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(MAXIMUM_DAILY_AVAILABILITY * 2);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(1 / 7);
	});
	it('full availability', async () => {
		const mockDate = new Date('2024-01-01T00:00:00');
		vi.setSystemTime(mockDate);

		await addAvailability(Date.now(), Date.now() + 14 * DAY, vehicle, company);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(MAXIMUM_DAILY_AVAILABILITY * 14);
		expect(states[0].prefactor).toBe(1);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(1);
	});
	it('1 hour', async () => {
		const mockDate = new Date('2024-01-01T00:00:00');
		vi.setSystemTime(mockDate);

		await addAvailability(Date.now() + 5 * HOUR, Date.now() + 6 * HOUR, vehicle, company);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(MAXIMUM_DAILY_AVAILABILITY / (MAXIMUM_DAILY_AVAILABILITY / HOUR));
		expect(states[0].prefactor).toBe(1);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(
			1 / AVAILABILITY_CONFIRMATION_DEADLINE_DAYS / (MAXIMUM_DAILY_AVAILABILITY / HOUR)
		);
	});
	it('1 block', async () => {
		const mockDate = new Date('2024-01-01T00:00:00');
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
		expect(states[0].score).toBe(
			MAXIMUM_DAILY_AVAILABILITY / (MAXIMUM_DAILY_AVAILABILITY / HOUR) / 4
		);
		expect(states[0].prefactor).toBe(1);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(
			1 / AVAILABILITY_CONFIRMATION_DEADLINE_DAYS / (MAXIMUM_DAILY_AVAILABILITY / HOUR) / 4
		);
	});
	it('touching 2 months', async () => {
		const mockDate = new Date('2024-01-31T00:00:00');
		vi.setSystemTime(mockDate);

		await addAvailability(Date.now(), Date.now() + 5 * DAY, vehicle, company);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(2);
		expect(states[0].score).toBe(MAXIMUM_DAILY_AVAILABILITY);
		expect(states[0].prefactor).toBe(1 / AVAILABILITY_CONFIRMATION_DEADLINE_DAYS);
		expect(states[1].score).toBe(MAXIMUM_DAILY_AVAILABILITY * 4);
		expect(states[1].prefactor).toBe(13 / AVAILABILITY_CONFIRMATION_DEADLINE_DAYS);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(1);

		const compensations2 = await computeCompensation(
			getStartOfMonth(new Date(mockDate.getTime() + DAY * 5))
		);
		expect(compensations2).toHaveLength(1);
		expect(compensations2[0].availabilityPercent).toBe((14 / 13) * (2 / 7));
	});
	it('2 vehicles', async () => {
		const mockDate = new Date('2024-01-01T00:00:00');
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

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(3 / 7);
	});
	it('availability stretching outside 2-week-window', async () => {
		const mockDate = new Date('2024-01-01T00:00:00');
		vi.setSystemTime(mockDate);
		await addAvailability(Date.now(), Date.now() + DAY, vehicle, company);

		const mockDate2 = new Date('2024-01-01T12:00:00');
		vi.setSystemTime(mockDate2);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(10 * HOUR);
		expect(states[0].prefactor).toBe(1);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(
			10 / AVAILABILITY_CONFIRMATION_DEADLINE_DAYS / (MAXIMUM_DAILY_AVAILABILITY / HOUR)
		);
	});
	it('touching 2 months full 2 weeks made available', async () => {
		const mockDate = new Date('2024-01-31T00:00:00');
		vi.setSystemTime(mockDate);
		await addAvailability(Date.now(), Date.now() + 14 * DAY, vehicle, company);
		await captureAvailabilityState();

		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(2);
		expect(states[0].score).toBe(MAXIMUM_DAILY_AVAILABILITY);
		expect(states[0].prefactor).toBe(1 / AVAILABILITY_CONFIRMATION_DEADLINE_DAYS);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(1);

		const compensations2 = await computeCompensation(
			getStartOfMonth(new Date(mockDate.getTime() + 5 * DAY))
		);
		expect(compensations2).toHaveLength(1);
		expect(compensations2[0].availabilityPercent).toBeGreaterThan(0.99999);
	});
	it('2 availability snapshots', async () => {
		const mockDate = new Date('2024-01-01T00:00:00');
		vi.setSystemTime(mockDate);
		await addAvailability(Date.now() + DAY * 3, Date.now() + 4 * DAY, vehicle, company);
		await captureAvailabilityState();

		const mockDate2 = new Date(mockDate.getTime() + MINUTE);
		vi.setSystemTime(mockDate2);
		await addAvailability(Date.now() + DAY * 3, Date.now() + 5 * DAY, vehicle, company);
		await deleteAvailability(Date.now() + DAY * 3 - MINUTE, Date.now() + DAY * 3, vehicle, company);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(2);
		expect(states[0].score).toBe(MAXIMUM_DAILY_AVAILABILITY);
		expect(states[0].prefactor).toBe(1);
		expect(states[1].score).toBe(2 * MAXIMUM_DAILY_AVAILABILITY);
		expect(states[1].prefactor).toBe(1);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(
			1.5 / AVAILABILITY_CONFIRMATION_DEADLINE_DAYS
		);
	});
	it('last hour of day', async () => {
		const mockDate = new Date('2024-01-01T00:00:00');
		vi.setSystemTime(mockDate);
		await addAvailability(Date.now() + HOUR * 21, Date.now() + 22 * HOUR, vehicle, company);
		await captureAvailabilityState();

		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(HOUR);
		expect(states[0].prefactor).toBe(1);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(
			1 / (MAXIMUM_DAILY_AVAILABILITY / HOUR) / AVAILABILITY_CONFIRMATION_DEADLINE_DAYS
		);
	});
	it('add disallowed availability -> score stays at zero', async () => {
		const mockDate = new Date('2024-01-01T00:00:00');
		vi.setSystemTime(mockDate);
		await addAvailability(Date.now() + HOUR * 24, Date.now() + 25 * HOUR, vehicle, company);
		await captureAvailabilityState();

		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(0);
		expect(states[0].prefactor).toBe(1);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(0);
	});
	it('add disallowed availability slightly before allowed -> score stays at zero', async () => {
		const mockDate = new Date('2024-01-01T00:00:00');
		vi.setSystemTime(mockDate);
		await addAvailability(Date.now() + HOUR * 26, Date.now() + 27 * HOUR, vehicle, company);
		await captureAvailabilityState();

		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(0);
		expect(states[0].prefactor).toBe(1);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(0);
	});
	it('add first hour of day', async () => {
		const mockDate = new Date('2024-01-01T00:00:00');
		vi.setSystemTime(mockDate);
		await addAvailability(Date.now() + HOUR * 29, Date.now() + 30 * HOUR, vehicle, company);
		await captureAvailabilityState();

		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(HOUR);
		expect(states[0].prefactor).toBe(1);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(
			1 / (MAXIMUM_DAILY_AVAILABILITY / HOUR) / AVAILABILITY_CONFIRMATION_DEADLINE_DAYS
		);
	});
	it('does startOfMonth match', async () => {
		const mockDate = new Date('2024-01-31T00:00:00');
		vi.setSystemTime(mockDate);
		await addAvailability(Date.now() + HOUR * 21, Date.now() + DAY * 2, vehicle, company);

		const mockDate2 = new Date('2024-01-31T21:30:00');
		vi.setSystemTime(mockDate2);
		await captureAvailabilityState();

		const mockDate3 = new Date('2024-01-31T23:30:00');
		vi.setSystemTime(mockDate3);

		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(2);
		expect(states[0].score).toBe(MINUTE * 30);
		expect(states[0].prefactor).toBe((MINUTE * 30) / MAXIMUM_AVAILABILITY_IN_CONFIRMATION_DEADLINE);
		expect(states[1].score).toBe(MAXIMUM_DAILY_AVAILABILITY);
		expect(states[1].prefactor).toBe(
			1 - (MINUTE * 30) / MAXIMUM_AVAILABILITY_IN_CONFIRMATION_DEADLINE
		);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(1);

		const compensations2 = await computeCompensation(
			getStartOfMonth(new Date(mockDate3.getTime() + 30 * MINUTE))
		);
		expect(compensations2).toHaveLength(1);
		expect(compensations2[0].availabilityPercent).toBe(
			MAXIMUM_DAILY_AVAILABILITY /
				MAXIMUM_AVAILABILITY_IN_CONFIRMATION_DEADLINE /
				(1 - (MINUTE * 30) / MAXIMUM_AVAILABILITY_IN_CONFIRMATION_DEADLINE)
		);
	});
	it('compute availability percent for full 2 weeks crossing month end', async () => {
		const mockDate = new Date('2024-01-30T00:00:00');
		vi.setSystemTime(mockDate);
		await addAvailability(Date.now() + DAY, Date.now() + 5 * DAY, vehicle, company);
		await captureAvailabilityState();

		const availabilityPercent = await getSnapshot(company);
		expect(availabilityPercent).toBe(4 / 14);
	});
	it('compute availability percent, availabilities in past are not conisdered', async () => {
		const mockDate = new Date('2024-01-15T00:00:00');
		vi.setSystemTime(mockDate);
		await addAvailability(Date.now() + DAY, Date.now() + 5 * DAY, vehicle, company);
		await captureAvailabilityState();
		vi.setSystemTime(new Date('2024-01-30T00:00:00'));

		const availabilityPercent = await getSnapshot(company);
		expect(availabilityPercent).toBe(0);
	});
});
