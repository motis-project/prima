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
		const previousTourFirstEvent = event({ id: 3715, tourId: 1126, arrival: 900 });
		const previousTourLastEvent = event({
			id: 3716,
			tourId: 1126,
			arrival: 900,
			scheduledTimeStart: 100
		});
		const overlappingTourEvent = event({ id: 9999, tourId: 9999, arrival: 2_000 });
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
			events: [
				previousTourFirstEvent,
				previousTourLastEvent,
				overlappingTourEvent,
				connectedTourFirstEvent,
				connectedTourSecondEvent
			]
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
			[1217],
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

	it('uses the last merged event and first event of the following tour', async () => {
		const mergedFirst = event({ id: 3997, tourId: 1217, departure: 1_000 });
		const mergedLast = event({
			id: 4002,
			tourId: 1217,
			departure: 1_000,
			arrival: 2_000,
			scheduledTimeStart: 1_800
		});
		const overlapping = event({
			id: 9999,
			tourId: 9999,
			departure: 1_500,
			arrival: 3_000,
			scheduledTimeStart: 2_050
		});
		const followingFirst = event({
			id: 5097,
			tourId: 1237,
			departure: 2_500,
			scheduledTimeStart: 2_600
		});
		const followingLast = event({
			id: 5098,
			tourId: 1237,
			departure: 2_500,
			scheduledTimeStart: 3_000
		});
		const vehicle = {
			events: [mergedFirst, mergedLast, overlapping, followingFirst, followingLast]
		} as unknown as VehicleWithInterval;
		const best = {
			pickupCase: { how: InsertHow.PREPEND },
			dropoffCase: { how: InsertHow.CONNECT }
		} as Insertion;
		vi.clearAllMocks();
		vi.mocked(oneToManyCarRouting).mockResolvedValueOnce([1_000]);

		await getDirectDurations(
			best,
			undefined,
			undefined,
			{} as ExpectedConnection,
			1217,
			[1217],
			1_000,
			2_000,
			vehicle
		);

		expect(oneToManyCarRouting).toHaveBeenLastCalledWith(mergedLast, [followingFirst], false);
	});
});
