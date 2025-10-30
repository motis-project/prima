import admin from 'firebase-admin';
import { db } from '$lib/server/db/index.js';
import Prom from 'prom-client';

let firebase_errors: Prom.Counter | undefined;
try {
	firebase_errors = new Prom.Counter({
		name: 'prima_firebase_errors_total',
		help: 'Firebase errors occurred'
	});
} catch {
	/* ignored */
}

export enum TourChange {
	BOOKED,
	MOVED,
	CANCELLED,
	REMINDER
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
					console.error(
						'Unable to delete fcm Token from database. With token: ',
						token,
						' and error: ',
						e
					);
				}
			} else if (error.code !== 'messaging/registration-token-not-registered') {
				firebase_errors?.inc();
			}
		} else {
			console.error(error);
			firebase_errors?.inc();
		}
	}
}
