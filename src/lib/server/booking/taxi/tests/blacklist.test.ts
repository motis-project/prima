import {
	addCompany,
	addTaxi,
	addTestUser,
	clearDatabase,
	setAvailability,
	setTour,
	Zone
} from '$lib/testHelpers';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createSession } from '$lib/server/auth/session';
import { black, inXMinutes } from '$lib/server/booking/testUtils';
import { DAY, HOUR, SECOND } from '$lib/util/time';
import { EARLIEST_SHIFT_START, LATEST_SHIFT_END, MIN_PREP } from '$lib/constants';

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

describe('Blacklist Tests', () => {
	it('Blacklist find interval', async () => {
		const company = await addCompany(Zone.NIESKY, inNiesky3);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(100), inXMinutes(150));
		const blackBody = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [],
			earliest: inXMinutes(0),
			latest: inXMinutes(600),
			startFixed: true,
			capacities
		});

		const blackResponse = await black(blackBody).then((r) => r.json());
		expect(blackResponse.start.length).toBe(0);
		expect(blackResponse.target.length).toBe(0);
		expect(blackResponse.direct.length).toBe(1);
		expect(blackResponse.direct[0].startTime).toBe(inXMinutes(100));
		expect(blackResponse.direct[0].endTime).toBe(inXMinutes(150));
	});
	it('Blacklist find cutoff interval', async () => {
		const company = await addCompany(Zone.NIESKY, inNiesky3);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(100), inXMinutes(150));
		const blackBody = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [],
			earliest: inXMinutes(0),
			latest: inXMinutes(125),
			startFixed: true,
			capacities
		});

		const blackResponse = await black(blackBody).then((r) => r.json());
		expect(blackResponse.start.length).toBe(0);
		expect(blackResponse.target.length).toBe(0);
		expect(blackResponse.direct.length).toBe(1);
		expect(blackResponse.direct[0].startTime).toBe(inXMinutes(100));
		expect(blackResponse.direct[0].endTime).toBe(inXMinutes(125));
	});
	it('Blacklist company in wrong zone', async () => {
		const company = await addCompany(Zone.GÖRLITZ, inNiesky3);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(100), inXMinutes(150));
		const blackBody = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [],
			earliest: inXMinutes(0),
			latest: inXMinutes(125),
			startFixed: true,
			capacities
		});

		const blackResponse = await black(blackBody).then((r) => r.json());
		expect(blackResponse.start.length).toBe(0);
		expect(blackResponse.target.length).toBe(0);
		expect(blackResponse.direct.length).toBe(0);
	});
	it('Blacklist find cutoff at start interval', async () => {
		const company = await addCompany(Zone.NIESKY, inNiesky3);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(100), inXMinutes(150));
		const blackBody = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [],
			earliest: inXMinutes(125),
			latest: inXMinutes(150),
			startFixed: true,
			capacities
		});

		const blackResponse = await black(blackBody).then((r) => r.json());
		expect(blackResponse.start.length).toBe(0);
		expect(blackResponse.target.length).toBe(0);
		expect(blackResponse.direct.length).toBe(1);
		expect(blackResponse.direct[0].startTime).toBe(inXMinutes(125));
		expect(blackResponse.direct[0].endTime).toBe(inXMinutes(150));
	});
	it('Blacklist merge availabilities', async () => {
		const company = await addCompany(Zone.NIESKY, inNiesky3);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(100), inXMinutes(150));
		await setAvailability(taxi, inXMinutes(120), inXMinutes(200));
		const blackBody = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [],
			earliest: inXMinutes(0),
			latest: inXMinutes(500),
			startFixed: true,
			capacities
		});

		const blackResponse = await black(blackBody).then((r) => r.json());
		expect(blackResponse.start.length).toBe(0);
		expect(blackResponse.target.length).toBe(0);
		expect(blackResponse.direct.length).toBe(1);
		expect(blackResponse.direct[0].startTime).toBe(inXMinutes(100));
		expect(blackResponse.direct[0].endTime).toBe(inXMinutes(200));
	});
	it('Blacklist merge tours', async () => {
		const company = await addCompany(Zone.NIESKY, inNiesky3);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setTour(taxi, inXMinutes(100), inXMinutes(150));
		await setTour(taxi, inXMinutes(120), inXMinutes(200));
		const blackBody = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [],
			earliest: inXMinutes(0),
			latest: inXMinutes(500),
			startFixed: true,
			capacities
		});

		const blackResponse = await black(blackBody).then((r) => r.json());
		expect(blackResponse.start.length).toBe(0);
		expect(blackResponse.target.length).toBe(0);
		expect(blackResponse.direct.length).toBe(1);
		expect(blackResponse.direct[0].startTime).toBe(inXMinutes(100));
		expect(blackResponse.direct[0].endTime).toBe(inXMinutes(200));
	});
	it('Blacklist merge tour and availability', async () => {
		const company = await addCompany(Zone.NIESKY, inNiesky3);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setTour(taxi, inXMinutes(90), inXMinutes(150));
		await setAvailability(taxi, inXMinutes(120), inXMinutes(200));
		const blackBody = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [],
			earliest: inXMinutes(0),
			latest: inXMinutes(500),
			startFixed: true,
			capacities
		});

		const blackResponse = await black(blackBody).then((r) => r.json());
		expect(blackResponse.start.length).toBe(0);
		expect(blackResponse.target.length).toBe(0);
		expect(blackResponse.direct.length).toBe(1);
		expect(blackResponse.direct[0].startTime).toBe(inXMinutes(90));
		expect(blackResponse.direct[0].endTime).toBe(inXMinutes(200));
	});
	it('Blacklist availability in the past', async () => {
		const now = Date.now();
		const company = await addCompany(Zone.NIESKY, inNiesky3);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, now, now + 0.5 * MIN_PREP);
		const blackBody = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [],
			earliest: now - HOUR,
			latest: now + DAY,
			startFixed: true,
			capacities
		});

		const blackResponse = await black(blackBody).then((r) => r.json());
		expect(blackResponse.start.length).toBe(0);
		expect(blackResponse.target.length).toBe(0);
		expect(blackResponse.direct.length).toBe(0);
	});
	it('Blacklist availability overlaps prep time', async () => {
		const now = Date.now();
		const currentHour = new Date(now).getHours();
		if (currentHour < EARLIEST_SHIFT_START + 1 || currentHour > LATEST_SHIFT_END - 1) {
			return;
		}
		const company = await addCompany(Zone.NIESKY, inNiesky3);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, now, now + 2 * MIN_PREP);
		const blackBody = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [],
			earliest: now - HOUR,
			latest: now + DAY,
			startFixed: true,
			capacities
		});

		const blackResponse = await black(blackBody).then((r) => r.json());
		expect(blackResponse.start.length).toBe(0);
		expect(blackResponse.target.length).toBe(0);
		expect(blackResponse.direct.length).toBe(1);
		expect(Math.abs(blackResponse.direct[0].startTime - now - MIN_PREP)).toBeLessThan(10 * SECOND);
		expect(blackResponse.direct[0].endTime).toBe(now + 2 * MIN_PREP);
	});
});
