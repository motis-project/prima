import { FUTURE_BOOKING_RESTRICTION } from '$lib/constants';
import { InsertHow, InsertWhat } from '$lib/util/booking/insertionTypes';
import { Interval } from '$lib/util/interval';
import { MINUTE } from '$lib/util/time';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InsertDirection, InsertWhere, type InsertionType } from '../insertionTypes';
import type { Event, VehicleWithInterval } from './getBookingAvailability';
import { getAllowedOperationTimes } from './durations';

const NOW = new Date('2026-01-01T12:00:00.000Z');
const insertionCase: InsertionType = {
	how: InsertHow.INSERT,
	direction: InsertDirection.BUS_STOP_DROPOFF,
	where: InsertWhere.BETWEEN_EVENTS,
	what: InsertWhat.USER_CHOSEN
};
const vehicle = {} as VehicleWithInterval;

function getWindows(windowStartTime: number) {
	const latestBooking = NOW.getTime() + FUTURE_BOOKING_RESTRICTION;
	const prev = { scheduledTimeStart: windowStartTime } as Event;
	const next = { scheduledTimeEnd: latestBooking + MINUTE } as Event;

	return getAllowedOperationTimes(
		insertionCase,
		prev,
		next,
		new Interval(windowStartTime, next.scheduledTimeEnd),
		NOW.getTime(),
		vehicle,
		[]
	);
}

describe('future taxi booking restriction', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('clips an operation window that starts before the restriction', () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const latestBooking = NOW.getTime() + FUTURE_BOOKING_RESTRICTION;

		expect(
			getWindows(latestBooking - MINUTE).map(({ startTime, endTime }) => [startTime, endTime])
		).toEqual([[latestBooking - MINUTE, latestBooking]]);
	});

	it('rejects an operation window after the restriction', () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const latestBooking = NOW.getTime() + FUTURE_BOOKING_RESTRICTION;

		expect(getWindows(latestBooking + 1)).toEqual([]);
	});
});
