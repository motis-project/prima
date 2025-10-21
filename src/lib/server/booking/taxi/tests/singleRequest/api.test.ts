import {
	addCompany,
	addTaxi,
	addTestUser,
	clearDatabase,
	getTours,
	setAvailability,
	Zone
} from '$lib/testHelpers';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { COORDINATE_ROUNDING_ERROR_THRESHOLD } from '$lib/constants';
import { createSession } from '$lib/server/auth/session';
import { MINUTE, roundToUnit } from '$lib/util/time';
import type { ExpectedConnection } from '$lib/server/booking/expectedConnection';
import { signEntry } from '$lib/server/booking/signEntry';
import { bookingApi } from '$lib/server/booking/taxi/bookingApi';
import { black, dateInXMinutes, inXMinutes, white } from '$lib/server/booking/testUtils';
import { Mode } from '$lib/server/booking/mode';

let sessionToken: string;

const capacities = {
	passengers: 1,
	wheelchairs: 0,
	bikes: 0,
	luggage: 0
};

const inNiesky1 = { lat: 51.29468377345111, lng: 14.833542206420248 };
const inNiesky2 = { lat: 51.29544187321241, lng: 14.820560314788537 };
const inNiesky3 = { lat: 51.294046423258095, lng: 14.820774891510126 };

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
	it('no company', async () => {
		const body = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [
				{
					...inNiesky3,
					times: [dateInXMinutes(580).getTime()]
				}
			],
			directTimes: [dateInXMinutes(550).getTime()],
			startFixed: true,
			capacities
		});
		const blackResponse = await black(body).then((r) => r.json());

		expect(blackResponse.start.length).toBe(0);
		expect(blackResponse.target.length).toBe(1);
		expect(blackResponse.direct.length).toBe(1);
		expect(blackResponse.target[0][0]).toBe(false);
		expect(blackResponse.direct[0]).toBe(false);

		const whiteResponse = await white(body).then((r) => r.json());
		expect(whiteResponse.start.length).toBe(0);
		expect(whiteResponse.target.length).toBe(1);
		for (let i = 0; i != whiteResponse.target.length; ++i) {
			expect(whiteResponse.target[i].length).toBe(1);
			expect(whiteResponse.target[i][0]).toBe(null);
		}
		expect(whiteResponse.direct.length).toBe(1);
		expect(whiteResponse.direct[0]).toBe(null);
	});

	it('company in wrong zone', async () => {
		const company = await addCompany(Zone.GÖRLITZ, inNiesky3);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(0), inXMinutes(999999));
		const body = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [
				{
					...inNiesky3,
					times: [inXMinutes(580)]
				}
			],
			directTimes: [inXMinutes(550)],
			startFixed: true,
			capacities
		});
		const blackResponse = await black(body).then((r) => r.json());
		expect(blackResponse.start.length).toBe(0);
		expect(blackResponse.target.length).toBe(1);
		expect(blackResponse.direct.length).toBe(1);
		expect(blackResponse.target[0][0]).toBe(false);
		expect(blackResponse.direct[0]).toBe(false);

		const whiteResponse = await white(body).then((r) => r.json());
		expect(whiteResponse.start.length).toBe(0);
		expect(whiteResponse.target.length).toBe(1);
		for (let i = 0; i != whiteResponse.target.length; ++i) {
			expect(whiteResponse.target[i].length).toBe(1);
			expect(whiteResponse.target[i][0]).toBe(null);
		}
		expect(whiteResponse.direct.length).toBe(1);
		expect(whiteResponse.direct[0]).toBe(null);
	});

	it('no vehicle', async () => {
		await addCompany(Zone.NIESKY, inNiesky3);
		const body = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [
				{
					...inNiesky3,
					times: [inXMinutes(580)]
				}
			],
			directTimes: [inXMinutes(550)],
			startFixed: true,
			capacities
		});
		const blackResponse = await black(body).then((r) => r.json());
		expect(blackResponse.start.length).toBe(0);
		expect(blackResponse.target.length).toBe(1);
		expect(blackResponse.direct.length).toBe(1);
		expect(blackResponse.target[0][0]).toBe(false);
		expect(blackResponse.direct[0]).toBe(false);

		const whiteResponse = await white(body).then((r) => r.json());
		expect(whiteResponse.start.length).toBe(0);
		expect(whiteResponse.target.length).toBe(1);
		for (let i = 0; i != whiteResponse.target.length; ++i) {
			expect(whiteResponse.target[i].length).toBe(1);
			expect(whiteResponse.target[i][0]).toBe(null);
		}
		expect(whiteResponse.direct.length).toBe(1);
		expect(whiteResponse.direct[0]).toBe(null);
	});

	it('no availability', async () => {
		const company = await addCompany(Zone.NIESKY, inNiesky3);
		await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		const body = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [
				{
					...inNiesky3,
					times: [inXMinutes(580)]
				}
			],
			directTimes: [inXMinutes(550)],
			startFixed: true,
			capacities
		});
		const blackResponse = await black(body).then((r) => r.json());
		expect(blackResponse.start.length).toBe(0);
		expect(blackResponse.target.length).toBe(1);
		expect(blackResponse.direct.length).toBe(1);
		expect(blackResponse.target[0][0]).toBe(false);
		expect(blackResponse.direct[0]).toBe(false);

		const whiteResponse = await white(body).then((r) => r.json());
		expect(whiteResponse.start.length).toBe(0);
		expect(whiteResponse.target.length).toBe(1);
		for (let i = 0; i != whiteResponse.target.length; ++i) {
			expect(whiteResponse.target[i].length).toBe(1);
			expect(whiteResponse.target[i][0]).toBe(null);
		}
		expect(whiteResponse.direct.length).toBe(1);
		expect(whiteResponse.direct[0]).toBe(null);
	});

	it('blacklist fail because request would require taxi to operate outside of defined shift (4:00-23:00)', async () => {
		const company = await addCompany(Zone.NIESKY, inNiesky3);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(0), inXMinutes(1600));
		const body = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(600)],
			startFixed: true,
			capacities
		});
		const blackResponse = await black(body).then((r) => r.json());
		expect(blackResponse.start.length).toBe(0);
		expect(blackResponse.target.length).toBe(0);
		expect(blackResponse.direct.length).toBe(1);
		expect(blackResponse.direct[0]).toBe(false);
	});

	it('whitelist fail because request would require taxi to operate outside of defined shift (4:00-23:00)', async () => {
		const company = await addCompany(Zone.NIESKY, inNiesky3);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(0), inXMinutes(1600));
		const body = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(600)],
			startFixed: true,
			capacities
		});

		const whiteResponse = await white(body).then((r) => r.json());
		expect(whiteResponse.start.length).toBe(0);
		expect(whiteResponse.target.length).toBe(0);
		expect(whiteResponse.direct.length).toBe(1);
		expect(whiteResponse.direct[0]).toBe(null);
	});

	it('simple success case', async () => {
		const company = await addCompany(Zone.NIESKY, inNiesky3);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(0), inXMinutes(600));
		const busStops = [];
		busStops.push({
			...inNiesky3,
			times: [inXMinutes(100)]
		});
		const body = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: busStops,
			directTimes: [inXMinutes(70)],
			startFixed: true,
			capacities
		});

		const blackResponse = await black(body).then((r) => r.json());
		expect(blackResponse.start.length).toBe(0);
		expect(blackResponse.target.length).toBe(1);
		expect(blackResponse.direct.length).toBe(1);
		expect(blackResponse.target[0][0]).toBe(true);
		expect(blackResponse.direct[0]).toBe(true);

		const whiteResponse = await white(body).then((r) => r.json());
		expect(whiteResponse.start.length).toBe(0);
		expect(whiteResponse.target.length).toBe(1);
		for (let i = 0; i != whiteResponse.target.length; ++i) {
			expect(whiteResponse.target[i].length).toBe(1);
			expect(whiteResponse.target[i][0]).not.toBe(null);
		}
		expect(whiteResponse.direct.length).toBe(1);
		expect(whiteResponse.direct[0]).not.toBe(null);

		const connection1: ExpectedConnection = {
			start: { ...inNiesky1, address: 'start address' },
			target: { ...inNiesky2, address: 'target address' },
			startTime: whiteResponse.direct[0].pickupTime,
			targetTime: whiteResponse.direct[0].dropoffTime,
			signature: signEntry(
				inNiesky1.lat,
				inNiesky1.lng,
				inNiesky2.lat,
				inNiesky2.lng,
				whiteResponse.direct[0].pickupTime,
				whiteResponse.direct[0].dropoffTime,
				false
			),
			startFixed: true,
			requestedTime: inXMinutes(70),
			mode: Mode.TAXI
		};
		const bookingBody = {
			connection1,
			connection2: null,
			capacities
		};

		const bookingResponse = await bookingApi(bookingBody, mockUserId, false, false, 0, 0, 0);
		const tours = await getTours();
		expect(tours.length).toBe(1);
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
		expect(
			Math.abs(inNiesky1.lat - pickup.lat) + Math.abs(inNiesky1.lng - pickup.lng)
		).toBeLessThan(COORDINATE_ROUNDING_ERROR_THRESHOLD);
		expect(new Date(pickup.communicatedTime).toISOString()).toBe(dateInXMinutes(70).toISOString());
		expect(dropoff.address).toBe('target address');
		expect(
			Math.abs(inNiesky2.lat - dropoff.lat) + Math.abs(inNiesky2.lng - dropoff.lng)
		).toBeLessThan(COORDINATE_ROUNDING_ERROR_THRESHOLD);
		requests.some((r) => r.id == bookingResponse.request1Id);
	}, 30000);

	it('keeps Promise is robust to rounding to full minutes', async () => {
		const company = await addCompany(Zone.NIESKY, inNiesky3);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(0), inXMinutes(600));
		const busStops = [];
		busStops.push({
			...inNiesky3,
			times: [inXMinutes(100)]
		});
		const body = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: busStops,
			directTimes: [inXMinutes(70)],
			startFixed: true,
			capacities
		});

		await black(body).then((r) => r.json());
		const whiteResponse = await white(body).then((r) => r.json());

		const connection1: ExpectedConnection = {
			start: { ...inNiesky1, address: 'start address' },
			target: { ...inNiesky2, address: 'target address' },
			startTime: whiteResponse.direct[0].pickupTime,
			targetTime: roundToUnit(whiteResponse.direct[0].dropoffTime, MINUTE, Math.floor),
			signature: signEntry(
				inNiesky1.lat,
				inNiesky1.lng,
				inNiesky2.lat,
				inNiesky2.lng,
				whiteResponse.direct[0].pickupTime,
				roundToUnit(whiteResponse.direct[0].dropoffTime, MINUTE, Math.floor),
				false
			),
			startFixed: true,
			mode: Mode.TAXI,
			requestedTime: inXMinutes(70)
		};
		const bookingBody = {
			connection1,
			connection2: null,
			capacities
		};

		await bookingApi(bookingBody, mockUserId, false, false, 0, 0, 0);
		const tours = await getTours();
		expect(tours.length).toBe(1);
	}, 30000);

	it('invalid signature', async () => {
		const company = await addCompany(Zone.NIESKY, inNiesky3);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(0), inXMinutes(600));
		const busStops = [];
		busStops.push({
			...inNiesky3,
			times: [inXMinutes(100)]
		});
		const body = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: busStops,
			directTimes: [inXMinutes(70)],
			startFixed: true,
			capacities
		});

		const whiteResponse = await white(body).then((r) => r.json());
		const connection1: ExpectedConnection = {
			start: { ...inNiesky1, address: 'start address' },
			target: { ...inNiesky2, address: 'target address' },
			startTime: whiteResponse.direct[0].pickupTime,
			targetTime: whiteResponse.direct[0].dropoffTime,
			requestedTime: inXMinutes(70),
			signature: signEntry(
				inNiesky1.lat + 1,
				inNiesky1.lng,
				inNiesky2.lat,
				inNiesky2.lng,
				whiteResponse.direct[0].pickupTime,
				whiteResponse.direct[0].dropoffTime,
				false
			),
			startFixed: true,
			mode: Mode.TAXI
		};
		const bookingBody = {
			connection1,
			connection2: null,
			capacities
		};
		const response = await bookingApi(bookingBody, mockUserId, false, false, 0, 0, 0);
		const tours = await getTours();
		expect(response.status === 403);
		expect(tours.length).toBe(0);
	}, 30000);
});
