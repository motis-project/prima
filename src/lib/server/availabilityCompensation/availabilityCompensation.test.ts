import { addCompany, addTaxi, clearDatabase, Zone } from '$lib/testHelpers';
import { describe, it, beforeEach, expect, beforeAll, afterAll } from 'vitest';
import { vi } from 'vitest';
import { addAvailability } from '../addAvailability';
import {
	captureAvailabilityState,
	computeCompensation,
	computeCompensationInMemory,
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

// Deterministic PRNG (mulberry32) so failures are reproducible without relying on Math.random.
function mulberry32(seed: number) {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

async function insertState(
	stateCompany: number,
	startOfMonth: number,
	score: number,
	prefactor: number
) {
	await db
		.insertInto('availabilityState')
		.values({ company: stateCompany, startOfMonth, score, prefactor, takenAt: Date.now() })
		.execute();
}

function sortKey(r: { company: number; startOfMonth: number }) {
	return `${r.company}-${r.startOfMonth}`;
}

async function expectSqlMatchesInMemory(startOfMonth?: number, selectedCompany?: number) {
	const sqlResult = await computeCompensation(startOfMonth, selectedCompany);
	const inMemoryResult = await computeCompensationInMemory(startOfMonth, selectedCompany);

	const sorted = (arr: typeof sqlResult) =>
		[...arr].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
	const a = sorted(sqlResult);
	const b = sorted(inMemoryResult);

	expect(a).toHaveLength(b.length);
	for (let i = 0; i < a.length; i++) {
		expect(a[i].company).toBe(b[i].company);
		expect(a[i].startOfMonth).toBe(b[i].startOfMonth);
		expect(a[i].name).toBe(b[i].name);
		// Both implementations perform the same divisions in the same order over the
		// same double-precision floats, but Postgres SUM() may accumulate in a different
		// order than Array.reduce(), so allow for tiny floating point drift.
		expect(a[i].availabilityPercent).toBeCloseTo(b[i].availabilityPercent, 9);
	}
	return a;
}

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
	it('1 hour (single counted)', async () => {
		const mockDate = new Date('2024-01-01T00:00:00');
		vi.setSystemTime(mockDate);

		await addAvailability(Date.now() + 5 * HOUR, Date.now() + 6 * HOUR, vehicle, company);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(HOUR);
		expect(states[0].prefactor).toBe(1);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(
			1 / AVAILABILITY_CONFIRMATION_DEADLINE_DAYS / (MAXIMUM_DAILY_AVAILABILITY / HOUR)
		);
	});
	it('1 hour (double counted)', async () => {
		const mockDate = new Date('2024-01-01T00:00:00');
		vi.setSystemTime(mockDate);

		await addAvailability(Date.now() + 18 * HOUR, Date.now() + 19 * HOUR, vehicle, company);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(2 * HOUR);
		expect(states[0].prefactor).toBe(1);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(
			2 / AVAILABILITY_CONFIRMATION_DEADLINE_DAYS / (MAXIMUM_DAILY_AVAILABILITY / HOUR)
		);
	});
	it('all single counted hours', async () => {
		const mockDate = new Date('2024-01-01T00:00:00');
		vi.setSystemTime(mockDate);

		await addAvailability(Date.now() + 5 * HOUR, Date.now() + 18 * HOUR, vehicle, company);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(13 * HOUR);
		expect(states[0].prefactor).toBe(1);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(
			13 / AVAILABILITY_CONFIRMATION_DEADLINE_DAYS / (MAXIMUM_DAILY_AVAILABILITY / HOUR)
		);
	});
	it('all double counted hours', async () => {
		const mockDate = new Date('2024-01-01T00:00:00');
		vi.setSystemTime(mockDate);

		await addAvailability(Date.now() + 18 * HOUR, Date.now() + 23 * HOUR, vehicle, company);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(2 * 5 * HOUR);
		expect(states[0].prefactor).toBe(1);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(
			(2 * 5) / AVAILABILITY_CONFIRMATION_DEADLINE_DAYS / (MAXIMUM_DAILY_AVAILABILITY / HOUR)
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
		expect(states[0].score).toBe(HOUR / 4);
		expect(states[0].prefactor).toBe(1);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(
			1 / AVAILABILITY_CONFIRMATION_DEADLINE_DAYS / (MAXIMUM_DAILY_AVAILABILITY / HOUR) / 4
		);
	});
	it('1 double counted block', async () => {
		const mockDate = new Date('2024-01-01T00:00:00');
		vi.setSystemTime(mockDate);

		await addAvailability(
			Date.now() + 18 * HOUR,
			Date.now() + 18 * HOUR + 15 * MINUTE,
			vehicle,
			company
		);
		await captureAvailabilityState();
		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe((2 * HOUR) / 4);
		expect(states[0].prefactor).toBe(1);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(
			2 / AVAILABILITY_CONFIRMATION_DEADLINE_DAYS / (MAXIMUM_DAILY_AVAILABILITY / HOUR) / 4
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
		expect(states[0].score).toBe(6 * HOUR + 5 * 2 * HOUR);
		expect(states[0].prefactor).toBe(1);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(
			16 / AVAILABILITY_CONFIRMATION_DEADLINE_DAYS / (MAXIMUM_DAILY_AVAILABILITY / HOUR)
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
		await addAvailability(Date.now() + HOUR * 22, Date.now() + 23 * HOUR, vehicle, company);
		await captureAvailabilityState();

		const states = await db.selectFrom('availabilityState').selectAll().execute();
		expect(states).toHaveLength(1);
		expect(states[0].score).toBe(2 * HOUR);
		expect(states[0].prefactor).toBe(1);

		const compensations = await computeCompensation(getStartOfMonth(mockDate));
		expect(compensations).toHaveLength(1);
		expect(compensations[0].availabilityPercent).toBe(
			2 / (MAXIMUM_DAILY_AVAILABILITY / HOUR) / AVAILABILITY_CONFIRMATION_DEADLINE_DAYS
		);
	});
	it('add disallowed availability -> score stays at zero', async () => {
		const mockDate = new Date('2024-01-01T00:00:00');
		vi.setSystemTime(mockDate);
		await addAvailability(Date.now() + HOUR * 23, Date.now() + 24 * HOUR, vehicle, company);
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
		await addAvailability(Date.now() + HOUR * 28, Date.now() + 29 * HOUR, vehicle, company);
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
		expect(states[0].score).toBe(2 * (HOUR + MINUTE * 30));
		expect(states[0].prefactor).toBe(
			(2 * (HOUR + MINUTE * 30)) / MAXIMUM_AVAILABILITY_IN_CONFIRMATION_DEADLINE
		);
		expect(states[1].score).toBe(MAXIMUM_DAILY_AVAILABILITY);
		expect(states[1].prefactor).toBe(
			1 - (2 * (HOUR + MINUTE * 30)) / MAXIMUM_AVAILABILITY_IN_CONFIRMATION_DEADLINE
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
			(1 - (2 * (HOUR + MINUTE * 30)) / MAXIMUM_AVAILABILITY_IN_CONFIRMATION_DEADLINE)
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

describe('computeCompensation: SQL implementation matches in-memory implementation', () => {
	it('no rows', async () => {
		await expectSqlMatchesInMemory();
	});

	it('single row for a single company/month', async () => {
		await insertState(company, 0, MAXIMUM_AVAILABILITY_IN_CONFIRMATION_DEADLINE / 2, 1);
		await expectSqlMatchesInMemory();
		await expectSqlMatchesInMemory(0);
		await expectSqlMatchesInMemory(undefined, company);
		await expectSqlMatchesInMemory(0, company);
	});

	it('multiple snapshots, same company/month, equal prefactor', async () => {
		for (let i = 0; i < 5; i++) {
			await insertState(company, 0, (i + 1) * DAY, 1);
		}
		await expectSqlMatchesInMemory(0, company);
	});

	it('multiple snapshots, same company/month, varying prefactor (month-boundary-like)', async () => {
		// Mirrors what happens in production near a month boundary: per-minute captures
		// produce many rows per month with different prefactors as the remaining
		// in-month portion of the confirmation window shrinks.
		const rnd = mulberry32(42);
		for (let i = 0; i < 30; i++) {
			const prefactor = 0.01 + rnd() * 0.99;
			const score = rnd() * prefactor * MAXIMUM_AVAILABILITY_IN_CONFIRMATION_DEADLINE;
			await insertState(company, 0, score, prefactor);
		}
		await expectSqlMatchesInMemory(0, company);
		await expectSqlMatchesInMemory(0);
	});

	it('many companies, many months, randomized snapshots', async () => {
		const companyB = await addCompany(Zone.NIESKY, { lat: 0, lng: 0 });
		const companyC = await addCompany(Zone.GÖRLITZ, { lat: 0, lng: 0 });
		const rnd = mulberry32(1234);
		const companies = [company, companyB, companyC];
		const months = [0, 31 * DAY, 60 * DAY];
		for (const c of companies) {
			for (const startOfMonth of months) {
				const snapshotCount = 1 + Math.floor(rnd() * 8);
				for (let i = 0; i < snapshotCount; i++) {
					const prefactor = 0.001 + rnd() * 0.999;
					const score = rnd() * prefactor * MAXIMUM_AVAILABILITY_IN_CONFIRMATION_DEADLINE;
					await insertState(c, startOfMonth, score, prefactor);
				}
			}
		}

		await expectSqlMatchesInMemory();
		await expectSqlMatchesInMemory(0);
		await expectSqlMatchesInMemory(31 * DAY);
		await expectSqlMatchesInMemory(undefined, companyB);
		await expectSqlMatchesInMemory(31 * DAY, companyC);
	});

	it('zero score rows', async () => {
		await insertState(company, 0, 0, 1);
		await insertState(company, 0, 0, 0.5);
		await expectSqlMatchesInMemory(0, company);
	});

	it('company with no rows in requested month is absent from both results', async () => {
		await insertState(company, 0, DAY, 1);
		const result = await expectSqlMatchesInMemory(31 * DAY, company);
		expect(result).toHaveLength(0);
	});
});
