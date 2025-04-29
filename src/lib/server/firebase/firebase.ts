import admin from 'firebase-admin';
import { env } from '$env/dynamic/private';

if (!admin.apps.length) {
	admin.initializeApp({
		credential: admin.credential.cert({
			projectId: env.FIREBASE_PROJECT_ID,
			privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
			clientEmail: env.FIREBASE_CLIENT_EMAIL
		})
	});
}

export const adminAuth = admin.auth();
export const adminMessaging = admin.messaging();
export const adminDb = admin.firestore();

export enum TourChange {
	BOOKED,
	MOVED,
	CANCELLED
}

export type NotificationData = {
	tourId: number;
	change: TourChange;
};

export async function sendMsg(token: string, title: string, body: string, data: NotificationData) {
	const tourId = data.tourId.toString();
	const change = data.change.toString();
	const message = {
		token,
		notification: {
			title,
			body
		},
		data: {
			tourId,
			change
		}
	};

	adminMessaging
		.send(message, false)
		.then((response) => {
			console.log('Successfully sent message:', response);
		})
		.catch((error) => {
			console.error('Error sending message:', error);
		});
}
