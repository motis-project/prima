import {
	addCompany,
	addTaxi,
	addTestUser,
	clearDatabase,
	getTours,
	selectEvents,
	setEvent,
	setRequest,
	setTour
} from '$lib/testHelpers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSession } from './server/auth/session';
import { oneToManyCarRouting } from './server/util/oneToManyCarRouting';
import { PASSENGER_CHANGE_DURATION } from './constants';

let sessionToken: string;
async function waitAndSelectEvents() {
	await new Promise((resolve) => setTimeout(resolve, 2000));
	return await selectEvents();
}

beforeEach(async () => {
	await clearDatabase();
}, 5000000);

const cancelTour = async (tourId: number, message: string) => {
	await fetch('http://localhost:5173/api/cancelTour', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Cookie: `session = ${sessionToken}`
		},
		body: JSON.stringify({
			tourId,
			message
		})
	});
};
const inNiesky1 = { lat: 51.29468377345111, lng: 14.833542206420248 };
const inNiesky2 = { lat: 51.29544187321241, lng: 14.820560314788537 };

describe('tests for cancelling tours', () => {
	it('cancel tour', async () => {
		const c = await addCompany(1);
		const mockUserId = (await addTestUser(c)).id;
		sessionToken = 'generateSessionToken()';
		await createSession(sessionToken, mockUserId);
		const v = await addTaxi(c, { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 });
		const t = await setTour(v, 0, 0);
		await setTour(v, 0, 0);
		const r = (await setRequest(t!.id, mockUserId, '')).id;
		await setEvent(r, 0, true, 1, 1);
		await setEvent(r, 0, false, 1, 1);
		const r2 = (await setRequest(t!.id, mockUserId, '')).id;
		await setEvent(r2, 0, true, 1, 1);
		await setEvent(r2, 0, false, 1, 1);

		await cancelTour(t!.id, 'tour cancelled');
		const events = await waitAndSelectEvents();
		events.forEach((e) => {
			expect(e.eventCancelled).toBe(true);
			expect(e.requestCancelled).toBe(true);
			expect(e.tourCancelled).toBe(true);
			expect(e.message).toBe('tour cancelled');
		});
	});

	it('cancel tour with fare', async () => {
		const c = await addCompany(1);
		const mockUserId = (await addTestUser(c)).id;
		sessionToken = 'generateSessionToken()';
		await createSession(sessionToken, mockUserId);
		const v = await addTaxi(c, { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 });
		const t = await setTour(v, 0, 0, 1);
		const r = (await setRequest(t!.id, mockUserId, '')).id;
		await setEvent(r, 0, true, 1, 1);
		await setEvent(r, 0, false, 1, 1);
		const r2 = (await setRequest(t!.id, mockUserId, '')).id;
		await setEvent(r2, 0, true, 1, 1);
		await setEvent(r2, 0, false, 1, 1);

		await cancelTour(t!.id, 'tour cancelled');
		const events = await waitAndSelectEvents();
		events.forEach((e) => {
			expect(e.eventCancelled).toBe(false);
			expect(e.requestCancelled).toBe(false);
			expect(e.tourCancelled).toBe(false);
		});
	});

	it('cancel tour with checked ticket', async () => {
		const c = await addCompany(1);
		const mockUserId = (await addTestUser(c)).id;
		sessionToken = 'generateSessionToken()';
		await createSession(sessionToken, mockUserId);
		const v = await addTaxi(c, { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 });
		const t = await setTour(v, 0, 0);
		const r = (await setRequest(t!.id, mockUserId, '', 1, true)).id;
		await setEvent(r, 0, true, 1, 1);
		await setEvent(r, 0, false, 1, 1);
		const r2 = (await setRequest(t!.id, mockUserId, '')).id;
		await setEvent(r2, 0, true, 1, 1);
		await setEvent(r2, 0, false, 1, 1);

		await cancelTour(t!.id, 'tour cancelled');
		const events = await waitAndSelectEvents();
		events.forEach((e) => {
			expect(e.eventCancelled).toBe(false);
			expect(e.requestCancelled).toBe(false);
			expect(e.tourCancelled).toBe(false);
		});
	});

	it('validate directDuration after tour cancellation', async () => {
		const c = await addCompany(1);
		const mockUserId = (await addTestUser(c)).id;
		sessionToken = 'generateSessionToken()';
		await createSession(sessionToken, mockUserId);
		const v = await addTaxi(c, { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 });
		const t = await setTour(v, 0, 1);
		const r = (await setRequest(t!.id, mockUserId, '', 1)).id;
		await setEvent(r, 0, true, 1, 1);
		await setEvent(r, 1, false, inNiesky1.lat, inNiesky1.lng);

		const t2 = (await setTour(v, 2, 3))!.id;
		const r2 = (await setRequest(t2, mockUserId, '', 1)).id;
		await setEvent(r2, 2, true, 1, 1);
		await setEvent(r2, 3, false, 1, 1);

		const t3 = await setTour(v, 4, 5);
		const r3 = (await setRequest(t3!.id, mockUserId, '', 1)).id;
		await setEvent(r3, 4, true, inNiesky2.lat, inNiesky2.lng);
		await setEvent(r3, 5, false, 1, 1);

		await cancelTour(t2, 'tour cancelled');

		const events = await waitAndSelectEvents();

		events
			.filter((e) => e.requestid === r || e.requestid === r3)
			.forEach((e) => {
				expect(e.eventCancelled).toBe(false);
				expect(e.requestCancelled).toBe(false);
				expect(e.tourCancelled).toBe(false);
			});
		events
			.filter((e) => e.requestid === r2)
			.forEach((e) => {
				expect(e.eventCancelled).toBe(true);
				expect(e.requestCancelled).toBe(true);
				expect(e.tourCancelled).toBe(true);
			});

		const directDuration = await oneToManyCarRouting(inNiesky1, [inNiesky2], false);
		const tours = await getTours();
		const tour3 = tours.find((tour) => tour.id === t3?.id);
		expect(tour3).not.toBe(undefined);
		console.log({ directDuration });
		expect(tour3!.directDuration).toBe(
			directDuration[0] ? directDuration[0] + PASSENGER_CHANGE_DURATION : null
		);
	});
});
