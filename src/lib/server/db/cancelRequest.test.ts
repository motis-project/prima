import {
	addCompany,
	addTaxi,
	addTestUser,
	clearDatabase,
	selectEvents,
	setEvent,
	setRequest,
	setTour
} from '$lib/testHelpers';
import { beforeEach, describe, expect, it } from 'vitest';
import { cancelRequest } from './cancelRequest';
import { oneToManyCarRouting } from '../util/oneToManyCarRouting';
import { HOUR } from '$lib/util/time';
import { PASSENGER_CHANGE_DURATION } from '$lib/constants';

beforeEach(async () => {
	await clearDatabase();
}, 60000);

const inNiesky1 = { lat: 51.29468377345111, lng: 14.833542206420248 };
const inNiesky2 = { lat: 51.29544187321241, lng: 14.820560314788537 };
const inNiesky3 = { lng: 14.845146466279402, lat: 51.29262334437041 };
const inNiesky4 = { lng: 14.847266291203681, lat: 51.286559029182285 };
const now = Date.now() + HOUR;

describe('tests for cancelling requests', () => {
	it('cancel request - update prevLeg from company', async () => {
		const u = await addTestUser();
		const c = await addCompany(1, inNiesky3);
		await addTestUser(c);
		const v = await addTaxi(c, { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 });
		const t = await setTour(v, 0, 0);
		const r = (await setRequest(t!.id, u.id, '')).id;
		const e1 = await setEvent(r, now, true, inNiesky1.lat, inNiesky1.lng);
		const e2 = await setEvent(r, now + 1, false, inNiesky2.lat, inNiesky2.lng);
		const r2 = (await setRequest(t!.id, u.id, '')).id;
		const e3 = await setEvent(r2, now + 2, true, inNiesky2.lat, inNiesky2.lng);
		await setEvent(r2, now + 3, false, inNiesky1.lat, inNiesky1.lng);

		const prevLeg = await oneToManyCarRouting(inNiesky3, [inNiesky2], false);

		await cancelRequest(r, u.id);
		const events = await selectEvents();
		expect(events.length).toBe(4);
		events.forEach((e) => {
			if (e.eventid == e3) {
				expect(e.prevLegDuration).toBe(prevLeg[0]);
			}
			if (e.eventid == e1 || e.eventid == e2) {
				expect(e.requestid).toBe(r);
				expect(e.eventCancelled).toBe(true);
				expect(e.requestCancelled).toBe(true);
				expect(e.tourCancelled).toBe(false);
			} else {
				expect(e.requestid).toBe(r2);
				expect(e.eventCancelled).toBe(false);
				expect(e.requestCancelled).toBe(false);
				expect(e.tourCancelled).toBe(false);
			}
		});

		await cancelRequest(r2, u.id);
		const events2 = await selectEvents();
		expect(events2.length).toBe(4);
		events2.forEach((e) => {
			expect(e.eventCancelled).toBe(true);
			expect(e.requestCancelled).toBe(true);
			expect(e.tourCancelled).toBe(true);
		});
	});

	it('cancel request - update nextLeg to company', async () => {
		const u = await addTestUser();
		const c = await addCompany(1, inNiesky3);
		await addTestUser(c);
		const v = await addTaxi(c, { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 });
		const t = await setTour(v, 0, 0);
		const r = (await setRequest(t!.id, u.id, '')).id;
		await setEvent(r, now, true, inNiesky1.lat, inNiesky1.lng);
		const e2 = await setEvent(r, now + 1, false, inNiesky2.lat, inNiesky2.lng);
		const r2 = (await setRequest(t!.id, u.id, '')).id;
		const e3 = await setEvent(r2, now + 2, true, inNiesky2.lat, inNiesky2.lng);
		const e4 = await setEvent(r2, now + 3, false, inNiesky1.lat, inNiesky1.lng);

		const nextLeg = await oneToManyCarRouting(inNiesky2, [inNiesky3], false);

		await cancelRequest(r2, u.id);
		const events = await selectEvents();
		expect(events.length).toBe(4);
		events.forEach((e) => {
			if (e.eventid == e2) {
				expect(e.nextLegDuration).toBe(nextLeg[0]! + PASSENGER_CHANGE_DURATION);
			}
			if (e.eventid == e3 || e.eventid == e4) {
				expect(e.requestid).toBe(r2);
				expect(e.eventCancelled).toBe(true);
				expect(e.requestCancelled).toBe(true);
				expect(e.tourCancelled).toBe(false);
			} else {
				expect(e.requestid).toBe(r);
				expect(e.eventCancelled).toBe(false);
				expect(e.requestCancelled).toBe(false);
				expect(e.tourCancelled).toBe(false);
			}
		});

		await cancelRequest(r, u.id);
		const events2 = await selectEvents();
		expect(events2.length).toBe(4);
		events2.forEach((e) => {
			expect(e.eventCancelled).toBe(true);
			expect(e.requestCancelled).toBe(true);
			expect(e.tourCancelled).toBe(true);
		});
	});

	it('cancel request - update nextLeg to company and prev/next Leg between events', async () => {
		const u = await addTestUser();
		const c = await addCompany(1, inNiesky3);
		await addTestUser(c);
		const v = await addTaxi(c, { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 });
		const t = await setTour(v, 0, 0);
		const r = (await setRequest(t!.id, u.id, '')).id;
		await setEvent(r, now, true, inNiesky1.lat, inNiesky1.lng);
		const e2 = await setEvent(r, now + 1, false, inNiesky2.lat, inNiesky2.lng);
		const r2 = (await setRequest(t!.id, u.id, '')).id;
		const e3 = await setEvent(r2, now + 4, true, inNiesky2.lat, inNiesky2.lng);
		const e4 = await setEvent(r2, now + 3, false, inNiesky1.lat, inNiesky1.lng);
		const r3 = (await setRequest(t!.id, u.id, '')).id;
		const e5 = await setEvent(r3, now + 2, true, inNiesky4.lat, inNiesky4.lng);
		const e6 = await setEvent(r3, now + 5, false, inNiesky2.lat, inNiesky2.lng);

		const nextLeg3 = await oneToManyCarRouting(inNiesky2, [inNiesky3], false);
		const nextLeg2 = await oneToManyCarRouting(inNiesky2, [inNiesky1], false);

		await cancelRequest(r3, u.id);
		const events = await selectEvents();
		expect(events.length).toBe(6);
		events.forEach((e) => {
			if (e.eventid == e3) {
				expect(e.nextLegDuration).toBe(nextLeg3[0]! + PASSENGER_CHANGE_DURATION);
			}
			if (e.eventid === e2) {
				expect(e.nextLegDuration).toBe(nextLeg2[0]! + PASSENGER_CHANGE_DURATION);
			}
			if (e.eventid === e4) {
				expect(e.prevLegDuration).toBe(nextLeg2[0]! + PASSENGER_CHANGE_DURATION);
			}
			if (e.eventid == e5 || e.eventid == e6) {
				expect(e.requestid).toBe(r3);
				expect(e.eventCancelled).toBe(true);
				expect(e.requestCancelled).toBe(true);
				expect(e.tourCancelled).toBe(false);
			} else {
				expect(e.eventCancelled).toBe(false);
				expect(e.requestCancelled).toBe(false);
				expect(e.tourCancelled).toBe(false);
			}
		});
	});
});
