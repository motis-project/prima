import { PASSENGER_CHANGE_DURATION } from '$lib/constants';
import type { ExpectedConnection } from '$lib/server/booking/expectedConnection';
import { oneToManyCarRouting } from '$lib/server/util/oneToManyCarRouting';
import { InsertHow } from '$lib/util/booking/insertionTypes';
import { describe, expect, it, vi } from 'vitest';
import type { Event, VehicleWithInterval } from '../getBookingAvailability';
import type { Insertion } from '../insertion';
import { getDirectDurations } from './getDirectDrivingDurations';

vi.mock('$lib/server/util/oneToManyCarRouting', () => ({
	oneToManyCarRouting: vi.fn()
}));

const event = (values: Partial<Event>): Event =>
	({
		id: 0,
		tourId: 0,
		isPickup: false,
		scheduledTimeStart: 0,
		scheduledTimeEnd: 0,
		lat: 0,
		lng: 0,
		...values
	}) as unknown as Event;

describe('getDirectDurations', () => {
	it('uses the event at the departure boundary as the first event of a connected tour', async () => {
		const previousTourLastEvent = event({ id: 3716, tourId: 1126 });
		const connectedTourFirstEvent = event({
			id: 3997,
			tourId: 1217,
			isPickup: true,
			scheduledTimeStart: 940,
			scheduledTimeEnd: 1_000
		});
		const connectedTourSecondEvent = event({
			id: 3998,
			tourId: 1217,
			scheduledTimeStart: 1_462,
			scheduledTimeEnd: 1_462
		});
		const vehicle = {
			events: [previousTourLastEvent, connectedTourFirstEvent, connectedTourSecondEvent]
		} as unknown as VehicleWithInterval;
		const best = {
			pickupCase: { how: InsertHow.CONNECT },
			dropoffCase: { how: InsertHow.APPEND }
		} as Insertion;
		const routedDuration = 597_000;
		vi.mocked(oneToManyCarRouting).mockResolvedValueOnce([routedDuration]);

		const result = await getDirectDurations(
			best,
			undefined,
			undefined,
			{} as ExpectedConnection,
			1237,
			true,
			1_000,
			Number.MAX_SAFE_INTEGER,
			vehicle
		);

		expect(oneToManyCarRouting).toHaveBeenCalledOnce();
		expect(oneToManyCarRouting).toHaveBeenCalledWith(
			previousTourLastEvent,
			[connectedTourFirstEvent],
			false
		);
		expect(result.thisTour).toEqual({
			directDrivingDuration: routedDuration + PASSENGER_CHANGE_DURATION,
			tourId: 1237
		});
	});
});
