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
import { cancelTour } from './cancelTour';
import { createSession } from './server/auth/session';

beforeEach(async () => {
	await clearDatabase();
}, 5000000);

describe('tests for cancelling tours', () => {
	it('cancel tour', async () => {
		const c = await addCompany(1);
		const mockUserId = (await addTestUser(c)).id;
		const sessionToken = 'generateSessionToken()';
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
		const events = await selectEvents();
		events.forEach((e) => {
			expect(e.ec).toBe(true);
			expect(e.rc).toBe(true);
			expect(e.tc).toBe(true);
			expect(e.message).toBe('tour cancelled');
		});

		await cancelTour(t!.id, 'null');
		const events2 = await selectEvents();
		events2.forEach((e) => {
			expect(e.ec).toBe(true);
			expect(e.rc).toBe(true);
			expect(e.tc).toBe(true);
			expect(e.message).toBe(null);
		});
	});
});
