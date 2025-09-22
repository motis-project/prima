import {
	addCompany,
	addTaxi,
	addTestUser,
	clearDatabase,
	clearTours,
	getTours,
	setAvailability,
	Zone
} from '$lib/testHelpers';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { COORDINATE_ROUNDING_ERROR_THRESHOLD } from '$lib/constants';
import { createSession } from '$lib/server/auth/session';
import type { ExpectedConnection } from '$lib/server/booking/bookRide';
import { signEntry } from '$lib/server/booking/signEntry';
import { bookingApi } from '$lib/server/booking/bookingApi';
import { dateInXMinutes, inXMinutes, white } from './util';
import { db } from '$lib/server/db';
import { isSamePlace } from '../isSamePlace';

let sessionToken: string;

const capacities = {
	passengers: 1,
	wheelchairs: 0,
	bikes: 0,
	luggage: 0
};

const weisswasser1 = { lat: 51.4933128414404, lng: 14.625615073025045 };
const weisswasser2 = { lat: 51.50346269587732, lng: 14.640156152116674 };
const wwBhf = { lng: 14.639773018906737, lat: 51.505458376331234 };
const kleinP = { lng: 14.956738408358433, lat: 51.45449308437898 };

let mockUserId = -1;

beforeAll(async () => {
	await clearDatabase();
}, 60000);

beforeEach(async () => {
	await clearDatabase();
	mockUserId = (await addTestUser()).id;
	sessionToken = 'generateSessionToken()';
	console.log('Creating session for user ', mockUserId);
	await createSession(sessionToken, mockUserId);
});

describe('Whitelist and Booking API Tests', () => {
	it('simple success case', async () => {
		const company1 = await addCompany(Zone.WEIßWASSER, weisswasser1);
		const company2 = await addCompany(Zone.WEIßWASSER, weisswasser2);
		const taxi1 = await addTaxi(company1, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		const taxi2 = await addTaxi(company2, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi1, inXMinutes(0), inXMinutes(600));
		await setAvailability(taxi2, inXMinutes(0), inXMinutes(600));
		const score = { company1: 0, company2: 0 };
		const n = 1;
		for (let i = 0; i != n; ++i) {
			await clearTours();
			const body = JSON.stringify({
				start: wwBhf,
				target: kleinP,
				startBusStops: [],
				targetBusStops: [],
				directTimes: [inXMinutes(70)],
				startFixed: true,
				capacities
			});

			const whiteResponse = await white(body).then((r) => r.json());
			expect(whiteResponse.start.length).toBe(0);
			expect(whiteResponse.target.length).toBe(0);
			expect(whiteResponse.direct.length).toBe(1);
			expect(whiteResponse.direct[0]).not.toBe(null);

			const connection1: ExpectedConnection = {
				start: { ...wwBhf, address: 'start address' },
				target: { ...kleinP, address: 'target address' },
				startTime: whiteResponse.direct[0].pickupTime,
				targetTime: whiteResponse.direct[0].dropoffTime,
				signature: signEntry(
					wwBhf.lat,
					wwBhf.lng,
					kleinP.lat,
					kleinP.lng,
					whiteResponse.direct[0].pickupTime,
					whiteResponse.direct[0].dropoffTime,
					false
				),
				startFixed: true,
				requestedTime: inXMinutes(70)
			};
			const bookingBody = {
				connection1,
				connection2: null,
				capacities
			};

			const bookingResponse = await bookingApi(bookingBody, mockUserId, false, false, 0, 0, 0);
			const tours = await getTours();
			expect(tours.length).toBe(1);
			const company = await db
				.selectFrom('company')
				.innerJoin('vehicle', 'vehicle.company', 'company.id')
				.where('vehicle.id', '=', tours[0].vehicle)
				.selectAll()
				.executeTakeFirstOrThrow();
			const isCompany1 = isSamePlace({ lat: company.lat!, lng: company.lng! }, weisswasser1);
			const isCompany2 = isSamePlace({ lat: company.lat!, lng: company.lng! }, weisswasser2);
			if (isCompany1) {
				score.company1 += 1;
			}
			if (isCompany2) {
				score.company2 += 1;
			}
			expect(tours[0].requests.length).toBe(1);
			expect(tours[0].requests[0].events.length).toBe(2);
			expect(tours[0].requests[0].customer).toBe(mockUserId);
			const requests = tours[0].requests;
			const event1 = requests[0].events[0];
			const event2 = requests[0].events[1];
			expect(event1.isPickup).not.toBe(event2.isPickup);
			const pickup = event1.isPickup ? event1 : event2;
			const dropoff = !event1.isPickup ? event1 : event2;
			expect(pickup.address).toBe('start address');
			expect(Math.abs(wwBhf.lat - pickup.lat) + Math.abs(wwBhf.lng - pickup.lng)).toBeLessThan(
				COORDINATE_ROUNDING_ERROR_THRESHOLD
			);
			expect(new Date(pickup.communicatedTime).toISOString()).toBe(
				dateInXMinutes(70).toISOString()
			);
			expect(dropoff.address).toBe('target address');
			expect(Math.abs(kleinP.lat - dropoff.lat) + Math.abs(kleinP.lng - dropoff.lng)).toBeLessThan(
				COORDINATE_ROUNDING_ERROR_THRESHOLD
			);
			requests.some((r) => r.id == bookingResponse.request1Id);
		}
		console.log({ score: JSON.stringify(score, null, 2) });
	}, 300000);
});
