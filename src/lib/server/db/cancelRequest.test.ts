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

beforeEach(async () => {
	await clearDatabase();
}, 5000000);

describe('tests for cancelling requests', () => {
	it('cancel request', async () => {
		const u = await addTestUser();
		const c = await addCompany(1);
		const v = await addTaxi(c, { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 });
		const t = await setTour(v, 0, 0);
		const r = (await setRequest(t!.id, u.id, '')).id;
		const e1 = await setEvent(r, 0, true, 1, 1);
		const e2 = await setEvent(r, 0, false, 1, 1);
		const r2 = (await setRequest(t!.id, u.id, '')).id;
		await setEvent(r2, 0, true, 1, 1);
		await setEvent(r2, 0, false, 1, 1);

		await cancelRequest(r);
		const events = await selectEvents();
		expect(events.length).toBe(4);
		events.forEach((e) => {
			if (e.eventid == e1 || e.eventid == e2) {
				expect(e.requestid).toBe(r);
				expect(e.ec).toBe(true);
				expect(e.rc).toBe(true);
				expect(e.tc).toBe(false);
			} else {
				expect(e.requestid).toBe(r2);
				expect(e.ec).toBe(false);
				expect(e.rc).toBe(false);
				expect(e.tc).toBe(false);
			}
		});

		await cancelRequest(r2);
		const events2 = await selectEvents();
		expect(events2.length).toBe(4);
		events2.forEach((e) => {
			expect(e.ec).toBe(true);
			expect(e.rc).toBe(true);
			expect(e.tc).toBe(true);
		});
	});
});
