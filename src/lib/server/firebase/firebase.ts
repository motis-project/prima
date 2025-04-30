import admin from 'firebase-admin';
import { db } from '$lib/server/db/index.js';

/*if (!admin.apps.length) {
	admin.initializeApp({
		credential: admin.credential.cert({
			projectId: env.FIREBASE_PROJECT_ID,
			privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
			clientEmail: env.FIREBASE_CLIENT_EMAIL
		})
	});
}*/

export enum TourChange {
	BOOKED,
	MOVED,
	CANCELLED
}

export type NotificationData = {
	tourId: number;
	pickupTime: number;
	vehicleId: number;
	wheelchairs: number;
	change: TourChange;
};

export async function sendPushNotification(
	token: string,
	title: string,
	body: string,
	data: NotificationData
) {
	try {
		const response = await admin.messaging().send({
			token,
			notification: {
				title,
				body
			},
			data: {
				tourId: data.tourId.toString(),
				pickupTime: data.pickupTime.toString(),
				vehicleId: data.vehicleId.toString(),
				wheelchairs: data.wheelchairs.toString(),
				change: data.change.toString()
			}
		});

		return { success: true, messageId: response };
	} catch (error: any) {
		console.error('FCM error:', error);

		if (error.code === 'messaging/invalid-registration-token') {
			try {
				await db.deleteFrom('fcmToken').where('fcmToken', '=', token).executeTakeFirst();
			} catch (e) {
				console.error(e);
			}

			return { success: false, error: 'Invalid device token' };
		} else if (error.code === 'messaging/registration-token-not-registered') {
			return { success: false, error: 'Token not registered' };
		}

		return { success: false, error: 'Unknown error occurred' };
	}
}
