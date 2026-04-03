import {
	addCompany,
	addTaxi,
	addTestUser,
	clearDatabase,
	setAvailability,
	Zone
} from '$lib/testHelpers';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createSession } from '$lib/server/auth/session';
import { black, inXMinutes, white } from '$lib/server/booking/testUtils';

let sessionToken: string;

const capacities = {
	passengers: 3,
	wheelchairs: 0,
	bikes: 0,
	luggage: 0
};

const closeToWWBorder = { lng: 14.777507806853123, lat: 51.44280154921688 };
const inNiesky = {
	lng: 14.831827693553663,
	lat: 51.29862261964925
};
const inRietschen = {
	lng: 14.783687436397685,
	lat: 51.39660434027431
};
const inSchleife = { lng: 14.534302593694918, lat: 51.54315421310719 };

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

describe('Whitelist and Booking API Tests for expanded zones', () => {
	it('taxi ride crossing Weisswasser border (outside expanded Weisswasser)', async () => {
		const company = await addCompany(Zone.WEIßWASSER, inSchleife);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(0), inXMinutes(200));

		const blackBody = JSON.stringify({
			start: closeToWWBorder,
			target: inNiesky,
			startBusStops: [],
			targetBusStops: [],
			earliest: inXMinutes(0),
			latest: inXMinutes(70),
			startFixed: true,
			capacities
		});

		const blackResponse = await black(blackBody).then((r) => r.json());
		expect(blackResponse.direct.length).toBe(0);
	});
	it('taxi ride crossing Weisswasser border (inside expanded Weisswasser)', async () => {
		const company = await addCompany(Zone.WEIßWASSER, inSchleife);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(0), inXMinutes(200));

		const blackBody = JSON.stringify({
			start: closeToWWBorder,
			target: inRietschen,
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
			start: closeToWWBorder,
			target: inRietschen,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(70)],
			startFixed: true,
			capacities
		});

		const whiteResponse = await white(whiteBody).then((r) => r.json());
		expect(whiteResponse.direct.length).toBe(1);
		expect(whiteResponse.direct[0]).not.toBe(null);
	});
	it('taxi ride crossing Weisswasser border (inside expanded Weisswasser) with niesky comapny', async () => {
		const company = await addCompany(Zone.NIESKY, inNiesky);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(0), inXMinutes(200));

		const blackBody = JSON.stringify({
			start: inRietschen,
			target: closeToWWBorder,
			startBusStops: [],
			targetBusStops: [],
			earliest: inXMinutes(0),
			latest: inXMinutes(70),
			startFixed: true,
			capacities
		});

		const blackResponse = await black(blackBody).then((r) => r.json());
		expect(blackResponse.direct.length).toBe(0);
	});
});
