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
import { createSession } from '../auth/session';
import { MINUTE } from '$lib/util/time';
import type { ExpectedConnection } from './bookRide';

const black = async (body: string) => {
	return await fetch('http://localhost:5173/api/blacklist', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body
	});
};

const white = async (body: string) => {
	return await fetch('http://localhost:5173/api/whitelist', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body
	});
};

let sessionToken: string;
const booking = async (body: string) => {
	return await fetch('http://localhost:5173/api/booking', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Cookie: `session = ${sessionToken}`
		},
		body
	});
};

const capacities = {
	passengers: 1,
	wheelchairs: 0,
	bikes: 0,
	luggage: 0
};

const inNiesky1 = { lat: 51.29468377345111, lng: 14.833542206420248 };
const inNiesky2 = { lat: 51.29544187321241, lng: 14.820560314788537 };
const inNiesky3 = { lat: 51.294046423258095, lng: 14.820774891510126 };

const BASE_DATE = new Date('2050-09-23T17:00Z').getTime();
const dateInXMinutes = (x: number) => new Date(BASE_DATE + x * MINUTE);
const inXMinutes = (x: number) => BASE_DATE + x * MINUTE;
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

	it('blacklist fail because request would require taxi to operate outside of defined shift (6:00-21:00)', async () => {
		const company = await addCompany(Zone.NIESKY, inNiesky3);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(0), inXMinutes(600));
		const body = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(120)],
			startFixed: true,
			capacities
		});
		const blackResponse = await black(body).then((r) => r.json());
		expect(blackResponse.start.length).toBe(0);
		expect(blackResponse.target.length).toBe(0);
		expect(blackResponse.direct.length).toBe(1);
		expect(blackResponse.direct[0]).toBe(false);
	});

	it('whitelist fail because request would require taxi to operate outside of defined shift (6:00-21:00)', async () => {
		const company = await addCompany(Zone.NIESKY, inNiesky3);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(0), inXMinutes(600));
		const body = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(106)],
			startFixed: true,
			capacities
		});

		const blackResponse = await black(body).then((r) => r.json());
		expect(blackResponse.start.length).toBe(0);
		expect(blackResponse.target.length).toBe(0);
		expect(blackResponse.direct.length).toBe(1);
		expect(blackResponse.direct[0]).toBe(true);

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
		for (let i = 0; i != 1; i++) {
			busStops.push({
				...inNiesky3,
				times: [inXMinutes(100)]
			});
		}
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
			targetTime: whiteResponse.direct[0].dropoffTime
		};
		const bookingBody = JSON.stringify({
			connection1,
			connection2: null,
			capacities
		});

		const bookingResponse = await booking(bookingBody);
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
		expect(pickup.eventGroup).not.toBe(dropoff.eventGroup);

		expect(new Date(pickup.communicatedTime).toISOString()).toBe(
			new Date(whiteResponse.direct[0].pickupTime).toISOString()
		);
		expect(pickup.address).toBe('start address');
		expect(
			Math.abs(inNiesky1.lat - pickup.lat) + Math.abs(inNiesky1.lng - pickup.lng)
		).toBeLessThan(COORDINATE_ROUNDING_ERROR_THRESHOLD);
		expect(new Date(pickup.scheduledTimeStart).toISOString()).toBe(
			dateInXMinutes(70).toISOString()
		);

		expect(new Date(dropoff.communicatedTime).toISOString()).toBe(
			new Date(whiteResponse.direct[0].dropoffTime).toISOString()
		);
		expect(dropoff.address).toBe('target address');
		expect(
			Math.abs(inNiesky2.lat - dropoff.lat) + Math.abs(inNiesky2.lng - dropoff.lng)
		).toBeLessThan(COORDINATE_ROUNDING_ERROR_THRESHOLD);

		const response = await bookingResponse.json();
		requests.some((r) => r.id == response.firstMileRequestId);
	}, 30000);
});
