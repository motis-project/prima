import { addTestUser, clearDatabase } from '$lib/testHelpers';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createSession } from '$lib/server/auth/session';
import { inXMinutes } from '$lib/server/booking/testUtils';
import { addRideShareTour } from '../addRideShareTour';
import { getRideShareTours } from '../getRideShareTours';
import { Interval } from '$lib/util/interval';
import { createRideShareVehicle } from '../createRideShareVehicle';

let sessionToken: string;

const capacities = {
	passengers: 1,
	wheelchairs: 0,
	bikes: 0,
	luggage: 0
};

const inKleinPriebus = { lat: 51.45418081100274, lng: 14.95863481385976 };
const inSchleife = { lat: 51.54065368738395, lng: 14.53267340988063 };

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

describe('Create new ride share tour', () => {
	it('simple success case', async () => {
		const vehicle = await createRideShareVehicle(mockUserId, 0, 3, '', '', false);
		await addRideShareTour(
			inXMinutes(100),
			true,
			3,
			0,
			mockUserId,
			vehicle,
			inKleinPriebus,
			inSchleife
		);
		const rsTours = await getRideShareTours(
			capacities,
			new Interval(inXMinutes(0), inXMinutes(600))
		);
		expect(rsTours).toHaveLength(1);
	}, 30000);
});
