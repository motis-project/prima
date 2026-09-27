import { msg } from '$lib/msg';
import { Mode } from '$lib/server/booking/mode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	bookingApi: vi.fn(),
	bookingAttemptsInc: vi.fn(),
	bookingErrorsInc: vi.fn(),
	expectedConnectionFromLeg: vi.fn(),
	rediscoverWhitelistRequestTimes: vi.fn(),
	toExpectedConnectionWithISOStrings: vi.fn()
}));

vi.mock('prom-client', () => ({
	default: {
		Counter: class {
			inc: () => void;

			constructor({ name }: { name: string }) {
				this.inc =
					name === 'prima_booking_errors_total' ? mocks.bookingErrorsInc : mocks.bookingAttemptsInc;
			}
		}
	}
}));

vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$lib/server/booking/taxi/bookingApi', () => ({ bookingApi: mocks.bookingApi }));
vi.mock('$lib/server/booking/taxi/bookRide', () => ({
	toExpectedConnectionWithISOStrings: mocks.toExpectedConnectionWithISOStrings
}));
vi.mock('$lib/server/booking/expectedConnection', () => ({
	expectedConnectionFromLeg: mocks.expectedConnectionFromLeg
}));
vi.mock('$lib/server/util/rediscoverWhitelistRequestTimes', () => ({
	rediscoverWhitelistRequestTimes: mocks.rediscoverWhitelistRequestTimes
}));
vi.mock('$lib/server/booking/index', () => ({ rideShareApi: vi.fn() }));
vi.mock('$lib/server/sendMail', () => ({ sendMail: vi.fn() }));
vi.mock('$lib/util/sendBookingEmails', () => ({ sendBookingMails: vi.fn() }));

import { actions } from './+page.server';

const NOW = Date.UTC(2026, 8, 30, 12, 0);

function createEvent(timeOfferExpires: number) {
	const formData = new FormData();
	formData.set('passengers', '1');
	formData.set('luggage', '0');
	formData.set('wheelchairs', '0');
	formData.set('kidsZeroToTwo', '0');
	formData.set('kidsThreeToFour', '0');
	formData.set('kidsFiveToSix', '0');
	formData.set('kidsSevenToFourteen', '0');
	formData.set('startFixed', '1');
	formData.set(
		'json',
		JSON.stringify({
			legs: [
				{
					mode: 'ODM',
					from: { lat: 51.3, lon: 14.8, name: 'Start' },
					to: { lat: 51.4, lon: 14.9, name: 'Target' },
					startTime: new Date(NOW + 2 * 60 * 60 * 1000).toISOString(),
					endTime: new Date(NOW + 2.5 * 60 * 60 * 1000).toISOString(),
					tripId: JSON.stringify({ requestedTime: NOW + 2 * 60 * 60 * 1000 })
				}
			],
			signature1: 'signature',
			timeOfferExpires
		})
	);

	return {
		request: new Request('http://localhost/routing', { method: 'POST', body: formData }),
		locals: { session: { userId: 1, isService: false } }
	};
}

describe('bookItineraryWithOdm offer expiration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(Date, 'now').mockReturnValue(NOW);
		mocks.rediscoverWhitelistRequestTimes.mockReturnValue({
			requestedTime1: NOW + 2 * 60 * 60 * 1000,
			requestedTime2: undefined
		});
		mocks.expectedConnectionFromLeg.mockReturnValue({ mode: Mode.TAXI });
		mocks.toExpectedConnectionWithISOStrings.mockReturnValue(null);
		mocks.bookingApi.mockResolvedValue({ status: 400, message: 'expected test response' });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('continues to the booking API while the offer is still valid', async () => {
		const result = await actions.bookItineraryWithOdm(
			createEvent(NOW + 1) as Parameters<typeof actions.bookItineraryWithOdm>[0]
		);

		expect(mocks.bookingApi).toHaveBeenCalledOnce();
		expect(result).toEqual({ msg: msg('bookingError') });
	});

	it('returns offerExpired before booking and without recording a booking error', async () => {
		const result = await actions.bookItineraryWithOdm(
			createEvent(NOW - 1) as Parameters<typeof actions.bookItineraryWithOdm>[0]
		);

		expect(result).toEqual({ msg: msg('offerExpired') });
		expect(mocks.bookingApi).not.toHaveBeenCalled();
		expect(mocks.bookingErrorsInc).not.toHaveBeenCalled();
	});
});
