import { db } from '$lib/server/db/index.js';
import { sendMsg, TourChange, type NotificationData } from '$lib/server/firebase/firebase';

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
	switch (data.change) {
		case TourChange.BOOKED:
			title = 'Neue Fahrt';
			break;
		case TourChange.MOVED:
			title = 'Fahrt verschoben';
			break;
		case TourChange.CANCELLED:
			title = 'Fahrt abgesagt';
			break;
	}

	tokens.forEach((token) => {
		try {
			sendMsg(token.fcmToken, title, '', data);
		} catch (error) {
			console.log(error);
		}
	});
}
