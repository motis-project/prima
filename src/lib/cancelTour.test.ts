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
import { createSession } from './server/auth/session';

let sessionToken: string;

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
		const events = await selectEvents();
		events.forEach((e) => {
			expect(e.ec).toBe(true);
			expect(e.rc).toBe(true);
			expect(e.tc).toBe(true);
			expect(e.message).toBe('tour cancelled');
		});
	});
});
