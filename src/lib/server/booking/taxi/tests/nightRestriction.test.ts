import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addCompany, addTaxi, clearDatabase, setAvailability, Zone } from '$lib/testHelpers';
import { whitelist } from '$lib/../routes/api/whitelist/whitelist';

const companyLocation = { lat: 51.294046423258095, lng: 14.820774891510126 };
const start = { lat: 51.29468377345111, lng: 14.833542206420248 };
const target = { lat: 51.29544187321241, lng: 14.820560314788537 };
const capacities = {
	passengers: 1,
	wheelchairs: 0,
	bikes: 0,
	luggage: 0
};

const time = (iso: string) => new Date(iso).getTime();

describe('night booking restriction planning', () => {
	beforeEach(async () => {
		await clearDatabase();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('stops returning a night connection after the previous-day deadline', async () => {
		const company = await addCompany(Zone.NIESKY, companyLocation);
		const taxi = await addTaxi(company, {
			passengers: 3,
			wheelchairs: 0,
			bikes: 0,
			luggage: 0
		});
		await setAvailability(
			taxi,
			time('2026-06-02T03:00:00+02:00'),
			time('2026-06-02T07:00:00+02:00')
		);

		const requestedPickup = time('2026-06-02T03:30:00+02:00');
		const request = () => whitelist(target, [{ ...start, times: [requestedPickup] }], capacities, true);
		const dateNow = vi.spyOn(Date, 'now');

		dateNow.mockReturnValue(time('2026-06-01T20:00:00+02:00'));
		const beforeDeadline = await request();
		expect(beforeDeadline[0][0]).toBeDefined();
		expect(beforeDeadline[0][0]?.departure).toBeGreaterThanOrEqual(
			time('2026-06-02T03:00:00+02:00')
		);
		expect(beforeDeadline[0][0]?.departure).toBeLessThan(time('2026-06-02T06:00:00+02:00'));

		dateNow.mockReturnValue(time('2026-06-01T20:00:00.001+02:00'));
		const afterDeadline = await request();
		expect(afterDeadline[0][0]).toBeUndefined();
	}, 30_000);
});
