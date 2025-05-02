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

interface FCMError extends Error {
	code: string;
}

function isFCMError(error: unknown): error is FCMError {
	return typeof error === 'object' && error !== null && 'code' in error;
}

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
	} catch (error: unknown) {
		if (isFCMError(error)) {
			console.error('FCM error:', error.code);

			if (error.code === 'messaging/invalid-registration-token') {
				try {
					await db.deleteFrom('fcmToken').where('fcmToken', '=', token).executeTakeFirst();
				} catch (e) {
					console.log('Unable to delete fcm Token from database.', {token});
				}
			}
		}
	}
}
