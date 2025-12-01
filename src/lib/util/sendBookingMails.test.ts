import {
	addCompany,
	addTaxi,
	addTestUser,
	clearDatabase,
	setEvent,
	setRequest,
	setRideshareTour,
	setRideshareVehicle,
	setTour
} from '$lib/testHelpers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSession } from '../server/auth/session';

import { generateMail } from '$lib/server/sendMail';
import { sendBookingMails } from './sendBookingEmails';
import { Mode } from '$lib/server/booking/mode';
import { db } from '$lib/server/db';

let sessionToken: string;

beforeEach(async () => {
	await clearDatabase();
}, 5000000);

describe('tests for sending tour emails', () => {
	it('template taxi mail', async () => {
		const c = await addCompany(1);
		const mockUserId = (await addTestUser(c)).id;
		sessionToken = 'generateSessionToken()';
		await createSession(sessionToken, mockUserId);
		const v = await addTaxi(c, { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 });
		const t = await setTour(v, 0, 0, 1);
		const r = (await setRequest(t!.id, mockUserId, '')).id;
		await setEvent(r, 0, true, 1, 1);
		await setEvent(r, 1000 * 3600 * 5, false, 2, 2);
		const r2 = (await setRequest(t!.id, mockUserId, '')).id;
		await setEvent(r2, 0, true, 1, 1);
		await setEvent(r2, 0, false, 1, 1);

		let mailSubj = undefined;
		let mailAddr = undefined;
		/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
		let mailBody: any = undefined;
		await sendBookingMails(
			r,
			Mode.TAXI,
			db,
			/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
			async (template: any, subject: string, email: string, props: any) => {
				mailSubj = subject;
				mailAddr = email;
				mailBody = generateMail(template, props);
				console.log(mailBody);
			}
		);
		expect(mailSubj).toBe('Neue Beförderung');
		expect(mailAddr).toBe('company@owner.de');
		expect(mailBody?.text).contain('Guten Tag owner');
		expect(mailBody?.text).contain('Erster Halt: 1,1');
		expect(mailBody?.text).contain('Letzter Halt: 2,2');
		expect(mailBody?.text).contain('Geplanter Start: 01.01.70, 01:00');
		expect(mailBody?.text).contain('Geplante Ankunft: 01.01.70, 06:00');
		expect(mailBody?.text).contain('/taxi/accounting/?tourId=' + t?.id);
	});

	it('template rideshare mail', async () => {
		const c = await addCompany(1);
		const mockUserId = (await addTestUser()).id;
		const mockOwnerId = (await addTestUser(c)).id;
		sessionToken = 'generateSessionToken()';
		await createSession(sessionToken, mockOwnerId);
		const v = await setRideshareVehicle(mockOwnerId);
		const t = await setRideshareTour(v!.id, 0, 0);
		const r = (await setRequest(t!.id, mockOwnerId, '', 1, false, true)).id;
		await setEvent(r, 0, true, 1, 1);
		await setEvent(r, 1000 * 3600 * 5, false, 2, 2);
		const r2 = (await setRequest(t!.id, mockUserId, '', 1, false, true)).id;
		await setEvent(r2, 1000 * 3600 * 1, true, 1, 1);
		await setEvent(r2, 1000 * 3600 * 4, false, 51.29468377345111, 14.833542206420248);

		let mailSubj = undefined;
		let mailAddr = undefined;
		/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
		let mailBody: any = undefined;
		await sendBookingMails(
			r2,
			Mode.RIDE_SHARE,
			db,
			/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
			async (template: any, subject: string, email: string, props: any) => {
				mailSubj = subject;
				mailAddr = email;
				mailBody = generateMail(template, props);
				console.log(mailBody);
			}
		);
		expect(mailSubj).toBe('Neue Mitfahr-Anfrage');
		expect(mailAddr).toBe('company@owner.de');
		expect(mailBody?.text).contain('Guten Tag,');
		expect(mailBody?.text).contain('Ihrem Mitfahrangebot am 01.01.70, 01:00 von 1,1\nnach 2,2');
		expect(mailBody?.text).contain('Von: in der Nähe von 1,1');
		expect(mailBody?.text).contain('Nach: in der Nähe von Niesky');
		expect(mailBody?.text).contain('Geplanter Start: ~01.01.70, 02:00');
		expect(mailBody?.text).contain('Geplante Ankunft: ~01.01.70, 05:00');
		expect(mailBody?.text).contain('/ride-offers/' + t?.id);
	});
});
