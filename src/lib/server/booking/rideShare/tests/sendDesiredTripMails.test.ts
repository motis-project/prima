import { addDesiredTrip, addTestUser, clearDatabase } from '$lib/testHelpers';
import { beforeEach, describe, expect, it } from 'vitest';
import { generateMail } from '$lib/server/sendMail';
import { createSession } from '$lib/server/auth/session';
import { sendDesiredTripMails } from '../sendDesiredTripMails';
import { DAY, HOUR, MINUTE } from '$lib/util/time';
import { addRideShareTour } from '../addRideShareTour';
import { createRideShareVehicle } from '../createRideShareVehicle';

let sessionToken: string;
const inSchleife = { lat: 51.54065368738395, lng: 14.53267340988063 };
const inKleinPriebus = { lat: 51.45418081100274, lng: 14.95863481385976 };

beforeEach(async () => {
	await clearDatabase();
}, 5000000);

describe('tests for sending desired trip emails', () => {
	it('template desired trip mail', async () => {
		const mockUserId = (await addTestUser()).id;
		sessionToken = 'generateSessionToken()';
		await createSession(sessionToken, mockUserId);
		await addDesiredTrip(inSchleife, 'startaddresse', inKleinPriebus, 'zieladdresse', mockUserId);

		const v = await createRideShareVehicle(mockUserId, 0, 3, null, null, true, '', null, '');
		await addRideShareTour(
			[Date.now() + DAY],
			true,
			3,
			0,
			mockUserId,
			v,
			inSchleife,
			inKleinPriebus,
			'startaddresse',
			'zieladdresse'
		);

		let mailSubj = undefined;
		let mailAddr = undefined;
		/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
		let mailBody: any = undefined;
		await sendDesiredTripMails(
			inSchleife,
			inKleinPriebus,
			Date.now() + DAY - 10 * MINUTE,
			Date.now() + DAY + HOUR + 10 * MINUTE,
			/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
			async (template: any, subject: string, email: string, props: any) => {
				mailSubj = subject;
				mailAddr = email;
				mailBody = generateMail(template, props);
			},
			true
		);
		expect(mailSubj).toBe('Passendes Mitfahrangebot');
		expect(mailAddr).toBe('test@user.de');
		expect(mailBody?.text).contain(
			'Es wurde ein Mitfahrangebot passend zu Ihrem Gesuch eingestellt:'
		);
		expect(mailBody?.text).contain('Guten Tag customer');
		expect(mailBody?.text).contain('Start: ');
		expect(mailBody?.text).contain('startaddresse');
		expect(mailBody?.text).contain('Ziel: ');
		expect(mailBody?.text).contain('zieladdresse');
		expect(mailBody?.text).contain('Link zur Suche: url');
	});
});
