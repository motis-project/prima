import { db } from '$lib/server/db/index.js';
import {
	sendPushNotification,
	TourChange,
	type NotificationData
} from '$lib/server/firebase/firebase';
import { formatTime } from '$lib/util/formatTime';

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

	switch (data.change) {
		case TourChange.BOOKED:
			title = 'Neue Fahrt';
			body = `Neue Fahrt am ${formatTime(data.pickupTime)}`;
			break;
		case TourChange.MOVED:
			title = 'Fahrt verschoben';
			body = `Fahrt am ${formatTime(data.pickupTime)} wurde einem anderen Fahrzeug zugwiesen`;
			break;
		case TourChange.CANCELLED:
			title = 'Fahrt abgesagt';
			body = `Fahrt am ${formatTime(data.pickupTime)} wurde abgesagt`;
			break;
		case TourChange.REMINDER:
			title = 'Bevorstehende Fahrt';
			body = `Fahrt am ${formatTime(data.pickupTime)}`;
			break;
	}

	tokens.forEach((token) => {
		sendPushNotification(token.fcmToken, title, body, data);
	});
}
