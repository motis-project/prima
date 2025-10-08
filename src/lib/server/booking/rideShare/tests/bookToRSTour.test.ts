import { addTestUser, clearDatabase, getRSTours } from '$lib/testHelpers';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { COORDINATE_ROUNDING_ERROR_THRESHOLD } from '$lib/constants';
import { createSession } from '$lib/server/auth/session';
import { dateInXMinutes, inXMinutes, whiteRideShare } from '$lib/server/booking/testUtils';
import { signEntry } from '$lib/server/booking/signEntry';
import { rideShareApi } from '../rideShareApi';
import { addRideShareTour, getRideShareTourCommunicatedTimes } from '../addRideShareTour';
import { Mode } from '$lib/server/booking/mode';
import { createRideShareVehicle } from '../createRideShareVehicle';
import { acceptRideShareRequest } from '../acceptRideShareRequest';
import type { ExpectedConnection } from '$lib/server/booking/expectedConnection';

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
const inWeisswasser1 = { lat: 51.50717128906919, lng: 14.622989053100525 };
const inWeisswasser2 = { lat: 51.50412563855747, lng: 14.635632731583911 };
const inDüben1 = { lat: 51.57081851189798, lng: 14.614068743138432 };
const inDüben2 = { lat: 51.56434272469306, lng: 14.615612304230666 };

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
	it('getRideShareTourCommunicatedTimes', async () => {
		const vehicle = await createRideShareVehicle(mockUserId, 0, 3, '', '', false, 'test', null);
		const communicatedTimesStartFixed = await getRideShareTourCommunicatedTimes(
			inXMinutes(40),
			true,
			vehicle,
			inSchleife,
			inKleinPriebus
		);
		expect(communicatedTimesStartFixed?.start).toBe(inXMinutes(40));
		const communicatedTimesStartNotFixed = await getRideShareTourCommunicatedTimes(
			inXMinutes(40),
			false,
			vehicle,
			inSchleife,
			inKleinPriebus
		);
		expect(communicatedTimesStartNotFixed?.end).toBe(inXMinutes(40));
	});
	it('simple success case', async () => {
		const vehicle = await createRideShareVehicle(mockUserId, 0, 3, '', '', false, 'test', null);
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

		const whiteResponse = await whiteRideShare(body).then((r) => r.json());
		expect(whiteResponse.direct.length).toBe(1);
		expect(whiteResponse.direct[0].length).not.toBe(0);
		const connection1: ExpectedConnection = {
			start: { ...inSagar, address: 'start address' },
			target: { ...inPechern, address: 'target address' },
			startTime: whiteResponse.direct[0][0].pickupTime,
			targetTime: whiteResponse.direct[0][0].dropoffTime,
			signature: signEntry(
				inSagar.lat,
				inSagar.lng,
				inPechern.lat,
				inPechern.lng,
				whiteResponse.direct[0][0].pickupTime,
				whiteResponse.direct[0][0].dropoffTime,
				false
			),
			startFixed: true,
			requestedTime: inXMinutes(70),
			mode: Mode.RIDE_SHARE
		};
		const bookingBody = {
			connection1,
			connection2: null,
			capacities
		};

		const bookingResponse = await rideShareApi(bookingBody, mockUserId, false, 0, 0, 0, tourId!);
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

	it('request accpepted, sufficient profit', async () => {
		const vehicle = await createRideShareVehicle(mockUserId, 0, 3, '', '', false, 'test', null);
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
			start: inWeisswasser1,
			target: inWeisswasser2,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(50)],
			startFixed: true,
			capacities
		});
		const whiteResponse = await whiteRideShare(body).then((r) => r.json());
		expect(whiteResponse.direct.length).toBe(1);
		expect(whiteResponse.direct[0].length).not.toBe(0);
	}, 30000);

	it('request denied, insufficient profit', async () => {
		const vehicle = await createRideShareVehicle(mockUserId, 0, 3, '', '', false, 'test', null);
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
			start: inDüben1,
			target: inDüben2,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(52)],
			startFixed: true,
			capacities
		});
		const whiteResponse = await whiteRideShare(body).then((r) => r.json());
		expect(whiteResponse.direct.length).toBe(1);
		expect(whiteResponse.direct[0].length).toBe(0);
	}, 30000);
});
