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
import { setAutomaticAvailability } from './setAutomaticAvailability';
import { db } from './db';

const vehicle = (company: number, licensePlate: string) => ({
	company,
	licensePlate,
	passengers: 4,
	luggage: 2,
	wheelchairs: 0,
	bikes: 0
});

const automaticVehicles = async (company: number) =>
	(
		await db
			.selectFrom('vehicle')
			.select('id')
			.where('company', '=', company)
			.where('setAutomaticAvailability', '=', true)
			.orderBy('id')
			.execute()
	).map((v) => v.id);

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

	it('allows multiple automatically available vehicles per company', async () => {
		const company = await addCompany(Zone.NIESKY);
		const first = await createVehicle(vehicle(company, 'NY-B-1'));
		const second = await createVehicle(vehicle(company, 'NY-B-2'));

		expect(await setAutomaticAvailability(company, second, true)).toBe('ok');
		expect(await automaticVehicles(company)).toEqual([first, second]);
	});

	it('keeps at least one automatically available vehicle per company', async () => {
		const company = await addCompany(Zone.NIESKY);
		const first = await createVehicle(vehicle(company, 'NY-C-1'));
		const second = await createVehicle(vehicle(company, 'NY-C-2'));

		expect(await setAutomaticAvailability(company, first, false)).toBe('lastVehicle');
		expect(await automaticVehicles(company)).toEqual([first]);

		expect(await setAutomaticAvailability(company, second, true)).toBe('ok');
		expect(await setAutomaticAvailability(company, first, false)).toBe('ok');
		expect(await automaticVehicles(company)).toEqual([second]);
		expect(await setAutomaticAvailability(company, second, false)).toBe('lastVehicle');
	});

	it("does not change other companies' vehicles", async () => {
		const company = await addCompany(Zone.NIESKY);
		const otherCompany = await addCompany(Zone.GÖRLITZ);
		await createVehicle(vehicle(company, 'NY-E-1'));
		await createVehicle(vehicle(otherCompany, 'GR-E-1'));
		const foreign = await createVehicle(vehicle(otherCompany, 'GR-E-2'));

		expect(await setAutomaticAvailability(company, foreign, true)).toBe('vehicleNotFound');
		expect(await automaticVehicles(otherCompany)).not.toContain(foreign);
	});

	it('adds availability for every selected vehicle', async () => {
		const company = await addCompany(Zone.NIESKY);
		const first = await createVehicle(vehicle(company, 'NY-F-1'));
		const second = await createVehicle(vehicle(company, 'NY-F-2'));
		const unselected = await createVehicle(vehicle(company, 'NY-F-3'));
		await setAutomaticAvailability(company, second, true);

		const dayStart = new Date('2026-06-01T00:00:00+02:00').getTime();
		expect(await addAutomaticAvailability(new Interval(dayStart, dayStart + DAY))).toBe(2);

		const availabilities = await db
			.selectFrom('availability')
			.select('vehicle')
			.orderBy('vehicle')
			.execute();
		expect(availabilities.map((a) => a.vehicle)).toEqual([first, second]);
		expect(availabilities.map((a) => a.vehicle)).not.toContain(unselected);
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
