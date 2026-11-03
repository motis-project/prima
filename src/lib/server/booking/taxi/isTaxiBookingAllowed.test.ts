import { describe, expect, it } from 'vitest';
import { InsertHow } from '$lib/util/booking/insertionTypes';
import { isTaxiBookingAllowed, requiresTaxiBookingDeadline } from './isTaxiBookingAllowed';

const time = (iso: string) => new Date(iso).getTime();

describe('isTaxiBookingAllowed', () => {
	it('requires the deadline for new tours and earlier concatenation departures', () => {
		expect(requiresTaxiBookingDeadline(InsertHow.NEW_TOUR)).toBe(true);
		expect(requiresTaxiBookingDeadline(InsertHow.PREPEND, 99, 100)).toBe(true);
		expect(requiresTaxiBookingDeadline(InsertHow.PREPEND, 100, 100)).toBe(false);
		expect(requiresTaxiBookingDeadline(InsertHow.PREPEND, 101, 100)).toBe(false);
		expect(requiresTaxiBookingDeadline(InsertHow.APPEND, 99, 100)).toBe(false);
		expect(requiresTaxiBookingDeadline(InsertHow.INSERT, 99, 100)).toBe(false);
		expect(requiresTaxiBookingDeadline(InsertHow.CONNECT, 99, 100)).toBe(false);
	});

	it('does not restrict departures before 04:00 or from 06:00 onwards', () => {
		const afterDeadline = time('2026-06-01T20:00:01+02:00');

		expect(isTaxiBookingAllowed(time('2026-06-02T03:59:59+02:00'), afterDeadline)).toBe(true);
		expect(isTaxiBookingAllowed(time('2026-06-02T06:00:00+02:00'), afterDeadline)).toBe(true);
	});

	it('allows a 04:00 departure when booked at 20:00 on the previous day', () => {
		expect(
			isTaxiBookingAllowed(time('2026-06-02T04:00:00+02:00'), time('2026-06-01T20:00:00+02:00'))
		).toBe(true);
	});

	it('rejects departures from 04:00 until 06:00 when booked after the deadline', () => {
		const afterDeadline = time('2026-06-01T20:00:01+02:00');

		expect(isTaxiBookingAllowed(time('2026-06-02T04:00:00+02:00'), afterDeadline)).toBe(false);
		expect(isTaxiBookingAllowed(time('2026-06-02T05:59:59+02:00'), afterDeadline)).toBe(false);
	});

	it('restricts an early taxi departure even when passenger pickup is after 06:00', () => {
		const afterDeadline = time('2026-06-01T20:00:01+02:00');
		const taxiDeparture = time('2026-06-02T05:55:00+02:00');
		const passengerPickup = time('2026-06-02T06:05:00+02:00');

		expect(isTaxiBookingAllowed(taxiDeparture, afterDeadline)).toBe(false);
		expect(isTaxiBookingAllowed(passengerPickup, afterDeadline)).toBe(true);
	});

	it('uses the immediately preceding day for later departures', () => {
		expect(
			isTaxiBookingAllowed(time('2026-06-03T05:00:00+02:00'), time('2026-06-01T20:00:01+02:00'))
		).toBe(true);
	});

	it('calculates the deadline in Europe/Berlin across daylight-saving changes', () => {
		expect(
			isTaxiBookingAllowed(time('2026-03-29T04:00:00+02:00'), time('2026-03-28T20:00:00+01:00'))
		).toBe(true);
		expect(
			isTaxiBookingAllowed(time('2026-03-29T04:00:00+02:00'), time('2026-03-28T20:00:01+01:00'))
		).toBe(false);
	});
});
