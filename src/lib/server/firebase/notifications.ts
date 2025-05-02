import { LOCALE, TZ } from '$lib/constants';
import { db } from '$lib/server/db/index.js';
import {
	sendPushNotification,
	TourChange,
	type NotificationData
} from '$lib/server/firebase/firebase';

async function getTokens(companyId: number) {
	const tokens = await db
		.selectFrom('fcmToken')
		.select('fcmToken')
		.where('company', '=', companyId)
		.execute();

	return tokens;
}

export async function sendNotifications(companyId: number, data: NotificationData) {
	const tokens = await getTokens(companyId);

	let title = 'Änderung einer Fahrt';
	let body: string = '';

	const formatTime = (t: number) => {
		return new Date(t).toLocaleString(LOCALE, {
			day: '2-digit',
			month: '2-digit',
			year: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
			timeZone: TZ
		});
	};

	switch (data.change) {
		case TourChange.BOOKED:
			title = 'Neue Fahrt';
			body = `Neue Tour am ${formatTime(data.pickupTime)}`;
			break;
		case TourChange.MOVED:
			title = 'Fahrt verschoben';
			body = `Tour am ${formatTime(data.pickupTime)} wurde einem anderen Fahrzeug zugwiesen.`;
			break;
		case TourChange.CANCELLED:
			title = 'Fahrt abgesagt';
			body = `Tour am ${formatTime(data.pickupTime)} wurde abgesagt.`;
			break;
	}

	tokens.forEach((token) => {
		sendPushNotification(token.fcmToken, title, body, data);
	});
}
