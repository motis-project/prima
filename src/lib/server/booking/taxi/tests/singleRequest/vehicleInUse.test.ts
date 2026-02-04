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
import { createSession } from '$lib/server/auth/session';
import type { ExpectedConnection } from '$lib/server/booking/expectedConnection';
import { signEntry } from '$lib/server/booking/signEntry';
import { bookingApi } from '$lib/server/booking/taxi/bookingApi';
import { black, inXMinutes, white } from '$lib/server/booking/testUtils';
import { Mode } from '$lib/server/booking/mode';

let sessionToken: string;

const capacities = {
	passengers: 3,
	wheelchairs: 0,
	bikes: 0,
	luggage: 0
};

const inSchleife1 = { lng: 14.52871605284534, lat: 51.542426845522584 };
const inSchleife2 = {
	lng: 14.54208968262708,
	lat: 51.5452123938403
};
const inPriebus = { lng: 14.956745409017884, lat: 51.454554860185084 };

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
	it('vehicle busy', async () => {
		const company = await addCompany(Zone.WEIßWASSER, inSchleife1);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(0), inXMinutes(200));

		const blackBody = JSON.stringify({
			start: inSchleife2,
			target: inPriebus,
			startBusStops: [],
			targetBusStops: [],
			earliest: inXMinutes(0),
			latest: inXMinutes(70),
			startFixed: true,
			capacities
		});

		const blackResponse = await black(blackBody).then((r) => r.json());
		expect(blackResponse.direct.length).toBe(1);
		expect(blackResponse.direct[0].startTime).toBe(inXMinutes(0));
		expect(blackResponse.direct[0].endTime).toBe(inXMinutes(70));

		const whiteBody = JSON.stringify({
			start: inSchleife2,
			target: inPriebus,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(70)],
			startFixed: true,
			capacities
		});

		const whiteResponse = await white(whiteBody).then((r) => r.json());
		expect(whiteResponse.direct.length).toBe(1);
		expect(whiteResponse.direct[0]).not.toBe(null);

		const connection1: ExpectedConnection = {
			start: { ...inSchleife2, address: 'start address' },
			target: { ...inPriebus, address: 'target address' },
			startTime: whiteResponse.direct[0].pickupTime,
			targetTime: whiteResponse.direct[0].dropoffTime,
			signature: signEntry(
				inSchleife2.lat,
				inSchleife2.lng,
				inPriebus.lat,
				inPriebus.lng,
				whiteResponse.direct[0].pickupTime,
				whiteResponse.direct[0].dropoffTime,
				false,
				inXMinutes(70).toString()
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

		await bookingApi(bookingBody, mockUserId, false, false, 0, 0, 0, 0, false);
		const tours = await getTours();
		expect(tours.length).toBe(1);
		expect(tours[0].requests.length).toBe(1);

		const blackResponse2 = await black(blackBody).then((r) => r.json());
		expect(blackResponse2.direct.length).toBe(1);
		expect(blackResponse2.direct[0].startTime).toBe(inXMinutes(0));
		expect(blackResponse2.direct[0].endTime).toBe(inXMinutes(70));

		const whiteResponse2 = await white(whiteBody).then((r) => r.json());
		expect(whiteResponse2.direct.length).toBe(1);
		expect(whiteResponse2.direct[0]).toBe(null);
	});
});
