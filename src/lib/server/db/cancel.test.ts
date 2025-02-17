import {
	addCompany,
	addTaxi,
	addTestUser,
	clearDatabase,
	setEvent,
	setRequest,
	setTour
} from '$lib/testHelpers';
import { beforeEach, describe, expect, it } from 'vitest';
import { cancelRequest, cancelTour } from './cancel';
import { db } from '.';

const selectEvents = async () => {
	return await db
		.selectFrom('tour')
		.innerJoin('request', 'tour.id', 'request.tour')
		.innerJoin('event', 'event.request', 'request.id')
		.select([
			'event.id as eventid',
			'request.id as requestid',
			'tour.id as tourid',
			'event.cancelled as ec',
			'request.cancelled as rc',
			'tour.cancelled as tc',
			'tour.message'
		])
		.execute();
};

beforeEach(async () => {
	await clearDatabase();
}, 5000000);

describe('tests for cancelling tours or requests', () => {
	it('cancel request', async () => {
		const u = await addTestUser();
		const c = await addCompany(1);
		const v = await addTaxi(c, { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 });
		const t = await setTour(v, 0, 0);
		const r = (await setRequest(t!.id, u.id, '')).id;
		const e1 = await setEvent(r, 0, true, 1, 1);
		const e2 = await setEvent(r, 0, false, 1, 1);
		const r2 = (await setRequest(t!.id, u.id, '')).id;
		const e3 = await setEvent(r2, 0, true, 1, 1);
		const e4 = await setEvent(r2, 0, false, 1, 1);

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

	it('cancel tour', async () => {
		const u = await addTestUser();
		const c = await addCompany(1);
		const v = await addTaxi(c, { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 });
		const t = await setTour(v, 0, 0);
		const t2 = await setTour(v, 0, 0);
		const r = (await setRequest(t!.id, u.id, '')).id;
		const e1 = await setEvent(r, 0, true, 1, 1);
		const e2 = await setEvent(r, 0, false, 1, 1);
		const r2 = (await setRequest(t!.id, u.id, '')).id;
		const e3 = await setEvent(r2, 0, true, 1, 1);
		const e4 = await setEvent(r2, 0, false, 1, 1);

		await cancelTour(t!.id, 'tour cancelled');
		const events = await selectEvents();
		events.forEach((e) => {
			expect(e.ec).toBe(true);
			expect(e.rc).toBe(true);
			expect(e.tc).toBe(true);
			expect(e.message).toBe('tour cancelled');
		});

		await cancelTour(t!.id, null);
		const events2 = await selectEvents();
		events2.forEach((e) => {
			expect(e.ec).toBe(true);
			expect(e.rc).toBe(true);
			expect(e.tc).toBe(true);
			expect(e.message).toBe(null);
		});
	});
});
