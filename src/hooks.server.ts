import {
	validateSessionToken,
	setSessionTokenCookie,
	deleteSessionTokenCookie
} from '$lib/server/auth/session';
import { error, redirect, type Handle } from '@sveltejs/kit';
import admin from 'firebase-admin';
import { env } from '$env/dynamic/private';

const authHandle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get('session');
	const session = await validateSessionToken(token);
	if (
		(!session?.isAdmin && event.url.pathname.startsWith('/admin')) ||
		(!session?.companyId && event.url.pathname.startsWith('/taxi')) ||
		(!session?.companyId && event.url.pathname.startsWith('/api/driver')) ||
		(!session?.companyId && event.url.pathname.startsWith('/api/cancelTour'))
	) {
		error(403);
	}
	if (token && session) {
		setSessionTokenCookie(event, token, new Date(session.expiresAt));
		if (
			!session.isEmailVerified &&
			!event.url.pathname.startsWith('/account/verify-email') &&
			!event.url.pathname.startsWith('/account/settings')
		) {
			redirect(302, '/account/verify-email');
		}
		if (
			event.url.pathname.startsWith('/account/login') ||
			event.url.pathname.startsWith('/account/signup')
		) {
			redirect(302, '/account');
		}
	} else {
		if (
			event.url.pathname.startsWith('/bookings') ||
			(event.url.pathname.startsWith('/account') &&
				event.url.pathname !== '/account/login' &&
				event.url.pathname !== '/account/signup' &&
				event.url.pathname !== '/account/reset-password' &&
				event.url.pathname !== '/account/request-password-reset')
		) {
			redirect(302, '/account/login');
		}
		deleteSessionTokenCookie(event);
	}

	event.locals.session = session;

	return await resolve(event);
};

export const handle = authHandle;

try {
	admin.initializeApp({
		credential: admin.credential.cert({
			projectId: env.FIREBASE_PROJECT_ID,
			privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
			clientEmail: env.FIREBASE_CLIENT_EMAIL
		})
	});
} catch (e) {
	console.log(e);
}
