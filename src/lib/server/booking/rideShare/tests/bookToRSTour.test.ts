import { addTestUser, clearDatabase, getRSTours } from '$lib/testHelpers';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { COORDINATE_ROUNDING_ERROR_THRESHOLD } from '$lib/constants';
import { createSession } from '$lib/server/auth/session';
import { black, dateInXMinutes, inXMinutes, white } from '$lib/server/booking/testUtil';
import { signEntry } from '../../signEntry';
import type { ExpectedConnection } from '../bookRide';
import { rideShareApi } from '../rideShareApi';
import { addRideShareTour } from '../addRideShareTour';
import { Mode } from '$lib/server/booking/mode';
import { createRideShareVehicle } from '../createRideShareVehicle';
import { acceptRideShareRequest } from '../acceptRideShareRequest';

let sessionToken: string;

const capacities = {
	passengers: 1,
	wheelchairs: 0,
	bikes: 0,
	luggage: 0
};

const inSchleife = { lat: 51.54065368738395, lng: 14.53267340988063 };
const inKleinPriebus = { lat: 51.45418081100274, lng: 14.95863481385976 };
const inSagar = { lat: 51.513491399158426, lng: 14.758423042222006 };
const inPechern = { lat: 51.48316025426172, lng: 14.862461509965812 };

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

describe('add ride share request', () => {
	it('simple success case', async () => {
		const vehicle = await createRideShareVehicle(mockUserId, 0, 3, '', '', false);
		const tourId = await addRideShareTour(
			inXMinutes(40),
			true,
			3,
			0,
			mockUserId,
			vehicle,
			inSchleife,
			inKleinPriebus
		);
		expect(tourId).not.toBe(undefined);
		const body = JSON.stringify({
			start: inSagar,
			target: inPechern,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(70)],
			startFixed: true,
			capacities
		});

		const blackResponse = await black(body);
		console.log({blackResponse})

		const whiteResponse = await white(body).then((r) => r.json());
		expect(whiteResponse.directRideShare.length).toBe(1);
		expect(whiteResponse.directRideShare[0]).not.toBe(null);
		const connection1: ExpectedConnection = {
			start: { ...inSagar, address: 'start address' },
			target: { ...inPechern, address: 'target address' },
			startTime: whiteResponse.directRideShare[0][0].pickupTime,
			targetTime: whiteResponse.directRideShare[0][0].dropoffTime,
			signature: signEntry(
				inSagar.lat,
				inSagar.lng,
				inPechern.lat,
				inPechern.lng,
				whiteResponse.directRideShare[0][0].pickupTime,
				whiteResponse.directRideShare[0][0].dropoffTime,
				false
			),
			startFixed: true,
			requestedTime: inXMinutes(70),
			mode: Mode.RIDE_SHARE,
			tourId: tourId!
		};
		const bookingBody = {
			connection1,
			connection2: null,
			capacities
		};

		const bookingResponse = await rideShareApi(bookingBody, mockUserId, false, 0, 0, 0);
		const tours = await getRSTours();
		expect(tours.length).toBe(1);
		expect(tours[0].requests.length).toBe(2);
		const newlyAddedRequests = tours[0].requests.filter((r) =>
			r.events.some((e) => e.address === 'start address')
		);
		expect(newlyAddedRequests).toHaveLength(1);
		const newlyAddedRequest = newlyAddedRequests[0];
		expect(newlyAddedRequest.events.length).toBe(2);
		expect(newlyAddedRequest.customer).toBe(mockUserId);
		const event1 = newlyAddedRequest.events[0];
		const event2 = newlyAddedRequest.events[1];
		expect(event1.isPickup).not.toBe(event2.isPickup);
		const pickup = event1.isPickup ? event1 : event2;
		const dropoff = !event1.isPickup ? event1 : event2;
		expect(pickup.address).toBe('start address');
		expect(Math.abs(inSagar.lat - pickup.lat) + Math.abs(inSagar.lng - pickup.lng)).toBeLessThan(
			COORDINATE_ROUNDING_ERROR_THRESHOLD
		);
		expect(new Date(pickup.communicatedTime).toISOString()).toBe(dateInXMinutes(70).toISOString());
		expect(dropoff.address).toBe('target address');
		expect(
			Math.abs(inPechern.lat - dropoff.lat) + Math.abs(inPechern.lng - dropoff.lng)
		).toBeLessThan(COORDINATE_ROUNDING_ERROR_THRESHOLD);
		newlyAddedRequests.some((r) => r.id == bookingResponse.request1Id);

		// Alter pending status to false
		const requestId = bookingResponse.request1Id ?? bookingResponse.request2Id!;
		const response = await acceptRideShareRequest(requestId, mockUserId);
		expect(response.status).toBe(200);
		const tours2 = await getRSTours();
		const r = tours2[0].requests.find((r) => r.id === requestId);
		expect(r?.pending).toBeFalsy();
	}, 30000);
});
