import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/constants', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/constants')>();

	return {
		...actual,
		EARLIEST_SHIFT_START: 0,
		LATEST_SHIFT_END: 24 * 60 * 60 * 1000
	};
});

import { bookingApi } from '$lib/server/booking/taxi/bookingApi';
import type { ExpectedConnection } from '$lib/server/booking/expectedConnection';
import { Mode } from '$lib/server/booking/mode';
import { inXMinutes, prepareTest } from '$lib/server/booking/testUtils';
import { addCompany, addTaxi, getTours, setAvailability, Zone } from '$lib/testHelpers';
import { HOUR, MINUTE } from '$lib/util/time';

const capacities = {
	passengers: 1,
	wheelchairs: 0,
	bikes: 0,
	luggage: 0
};

const start = {
	lat: 51.29468377345111,
	lng: 14.833542206420248
};

const target = {
	lat: 51.29544187321241,
	lng: 14.820560314788537
};

const companyLocation = {
	lat: 51.294046423258095,
	lng: 14.820774891510126
};

let mockUserId: number;

beforeEach(async () => {
	mockUserId = await prepareTest();
});

describe('booking across midnight', () => {
	it('books and persists a tour spanning midnight with full-day shifts', async () => {
		const company = await addCompany(Zone.NIESKY, companyLocation);
		const taxi = await addTaxi(company, {
			passengers: 3,
			wheelchairs: 0,
			bikes: 0,
			luggage: 0
		});

		const midnight = new Date(inXMinutes(0));
		midnight.setHours(24, 0, 0, 0);
		const midnightTime = midnight.getTime();
		const requestedTime = midnightTime - MINUTE;

		await setAvailability(taxi, midnightTime - 2 * HOUR, midnightTime + 2 * HOUR);

		const connection: ExpectedConnection = {
			start: { ...start, address: 'start address' },
			target: { ...target, address: 'target address' },
			startTime: requestedTime,
			targetTime: requestedTime + HOUR,
			requestedTime,
			startFixed: true,
			signature: '',
			mode: Mode.TAXI
		};

		const bookingResponse = await bookingApi(
			{
				connection1: connection,
				connection2: null,
				capacities
			},
			mockUserId,
			false,
			true,
			0,
			0,
			0,
			0,
			true
		);

		expect(bookingResponse.status).toBe(200);

		const tours = await getTours();

		expect(tours).toHaveLength(1);
		expect(tours[0].requests).toHaveLength(1);
		expect(tours[0].departure).toBeLessThan(midnightTime);
		expect(tours[0].arrival).toBeGreaterThan(midnightTime);
	}, 30000);
});
