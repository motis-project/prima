import admin from 'firebase-admin';
import { db } from '$lib/server/db/index.js';

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
		await admin.messaging().send({
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
	} catch (error: any) {
		console.error('FCM error:', error.code);

		if (error.code === 'messaging/invalid-registration-token') {
			try {
				await db.deleteFrom('fcmToken').where('fcmToken', '=', token).executeTakeFirst();
			} catch (e) {
				console.error(e);
			}
		}
	}
}
