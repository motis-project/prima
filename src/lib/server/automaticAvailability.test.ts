import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	AUTOMATIC_AVAILABILITY_EARLIEST_END,
	AUTOMATIC_AVAILABILITY_EARLIEST_START,
	AUTOMATIC_AVAILABILITY_LATEST_END,
	AUTOMATIC_AVAILABILITY_LATEST_START
} from '$lib/constants';
import { addCompany, clearDatabase, Zone } from '$lib/testHelpers';
import { isValidAutomaticAvailabilityTime } from '$lib/util/automaticAvailabilityTime';
import { Interval } from '$lib/util/interval';
import { DAY, HOUR, MINUTE } from '$lib/util/time';
import { addAutomaticAvailability } from './addAutomaticAvailability';
import { createVehicle } from './createVehicle';
import { db } from './db';

const vehicle = (company: number, licensePlate: string) => ({
	company,
	licensePlate,
	passengers: 4,
	luggage: 2,
	wheelchairs: 0,
	bikes: 0
});

describe('automatic availability', () => {
	beforeEach(async () => {
		await clearDatabase();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('selects only the first vehicle created for a company', async () => {
		const company = await addCompany(Zone.NIESKY);
		const first = await createVehicle(vehicle(company, 'NY-A-1'));
		const second = await createVehicle(vehicle(company, 'NY-A-2'));

		const vehicles = await db
			.selectFrom('vehicle')
			.select(['id', 'setAutomaticAvailability'])
			.where('company', '=', company)
			.orderBy('id')
			.execute();

		expect(vehicles).toEqual([
			{ id: first, setAutomaticAvailability: true },
			{ id: second, setAutomaticAvailability: false }
		]);
	});

	it('enforces at most one automatically available vehicle per company in the database', async () => {
		const company = await addCompany(Zone.NIESKY);
		await createVehicle(vehicle(company, 'NY-B-1'));
		const second = await createVehicle(vehicle(company, 'NY-B-2'));

		await expect(
			db
				.updateTable('vehicle')
				.set({ setAutomaticAvailability: true })
				.where('id', '=', second)
				.execute()
		).rejects.toMatchObject({
			constraint: 'vehicle_one_automatic_availability_per_company_idx'
		});
	});

	it("uses each company's configured operating times", async () => {
		const earlyCompany = await addCompany(Zone.NIESKY);
		const lateCompany = await addCompany(Zone.GÖRLITZ);
		await db
			.updateTable('company')
			.set({ automaticAvailabilityStart: 3 * HOUR, automaticAvailabilityEnd: 19 * HOUR })
			.where('id', '=', earlyCompany)
			.execute();
		await db
			.updateTable('company')
			.set({ automaticAvailabilityStart: 7 * HOUR, automaticAvailabilityEnd: DAY })
			.where('id', '=', lateCompany)
			.execute();

		const earlyVehicle = await createVehicle(vehicle(earlyCompany, 'NY-C-1'));
		const lateVehicle = await createVehicle(vehicle(lateCompany, 'GR-C-1'));
		const dayStart = Date.parse('2026-01-15T00:00:00.000Z');

		expect(await addAutomaticAvailability(new Interval(dayStart, dayStart + DAY))).toBe(2);

		const availabilities = await db
			.selectFrom('availability')
			.select(['vehicle', 'startTime', 'endTime'])
			.orderBy('vehicle')
			.execute();
		expect(availabilities).toEqual([
			{
				vehicle: earlyVehicle,
				startTime: Date.parse('2026-01-15T02:00:00.000Z'),
				endTime: Date.parse('2026-01-15T18:00:00.000Z')
			},
			{
				vehicle: lateVehicle,
				startTime: Date.parse('2026-01-15T06:00:00.000Z'),
				endTime: Date.parse('2026-01-15T23:00:00.000Z')
			}
		]);
	});

	it('accepts only 15-minute values inside the configured ranges', () => {
		expect(
			isValidAutomaticAvailabilityTime(
				AUTOMATIC_AVAILABILITY_EARLIEST_START,
				AUTOMATIC_AVAILABILITY_EARLIEST_START,
				AUTOMATIC_AVAILABILITY_LATEST_START
			)
		).toBe(true);
		expect(
			isValidAutomaticAvailabilityTime(
				AUTOMATIC_AVAILABILITY_LATEST_END,
				AUTOMATIC_AVAILABILITY_EARLIEST_END,
				AUTOMATIC_AVAILABILITY_LATEST_END
			)
		).toBe(true);
		expect(
			isValidAutomaticAvailabilityTime(
				AUTOMATIC_AVAILABILITY_EARLIEST_START - 15 * MINUTE,
				AUTOMATIC_AVAILABILITY_EARLIEST_START,
				AUTOMATIC_AVAILABILITY_LATEST_START
			)
		).toBe(false);
		expect(
			isValidAutomaticAvailabilityTime(
				AUTOMATIC_AVAILABILITY_LATEST_END + 15 * MINUTE,
				AUTOMATIC_AVAILABILITY_EARLIEST_END,
				AUTOMATIC_AVAILABILITY_LATEST_END
			)
		).toBe(false);
		expect(
			isValidAutomaticAvailabilityTime(
				AUTOMATIC_AVAILABILITY_EARLIEST_START + MINUTE,
				AUTOMATIC_AVAILABILITY_EARLIEST_START,
				AUTOMATIC_AVAILABILITY_LATEST_START
			)
		).toBe(false);
	});
});
