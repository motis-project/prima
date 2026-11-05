import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addCompany, addTaxi, clearDatabase, setAvailability, Zone } from '$lib/testHelpers';
import { whitelist } from '$lib/../routes/api/whitelist/whitelist';
import { getNextWednesday } from '$lib/server/booking/testUtils';
import { DAY } from '$lib/util/time';

const companyLocation = { lat: 51.294046423258095, lng: 14.820774891510126 };
const start = { lat: 51.29468377345111, lng: 14.833542206420248 };
const target = { lat: 51.29544187321241, lng: 14.820560314788537 };
const capacities = {
	passengers: 1,
	wheelchairs: 0,
	bikes: 0,
	luggage: 0
};

const nextWednesdayAt = (hour: number, minute = 0) => {
	const timeOfDay = new Date();
	timeOfDay.setHours(hour, minute, 0, 0);
	return getNextWednesday(timeOfDay, new Date());
};

describe('night booking restriction planning', () => {
	beforeEach(async () => {
		await clearDatabase();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('stops returning a night connection after the previous-day deadline', async () => {
		const availabilityStart = nextWednesdayAt(3);
		const requestedPickup = nextWednesdayAt(3, 30);
		const availabilityEnd = nextWednesdayAt(7);
		const bookingDeadline = nextWednesdayAt(20) - DAY;

		const company = await addCompany(Zone.NIESKY, companyLocation);
		const taxi = await addTaxi(company, {
			passengers: 3,
			wheelchairs: 0,
			bikes: 0,
			luggage: 0
		});
		await setAvailability(taxi, availabilityStart, availabilityEnd);

		const request = () =>
			whitelist(target, [{ ...start, times: [requestedPickup] }], capacities, true);
		const dateNow = vi.spyOn(Date, 'now');

		dateNow.mockReturnValue(bookingDeadline);
		const beforeDeadline = await request();
		expect(beforeDeadline[0][0]).toBeDefined();
		expect(beforeDeadline[0][0]?.departure).toBeGreaterThanOrEqual(availabilityStart);
		expect(beforeDeadline[0][0]?.departure).toBeLessThan(nextWednesdayAt(6));

		dateNow.mockReturnValue(bookingDeadline + 1);
		const afterDeadline = await request();
		expect(afterDeadline[0][0]).toBeUndefined();
	}, 30_000);
});
