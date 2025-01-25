import {
	validateSessionToken,
	setSessionTokenCookie,
	deleteSessionTokenCookie
} from '$lib/server/auth/session';
import { sequence } from '@sveltejs/kit/hooks';
import { redirect, type Handle } from '@sveltejs/kit';

const authHandle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get('session');
	const session = await validateSessionToken(token);
	if (token && session) {
		setSessionTokenCookie(event, token, session.expiresAt);
		if (
			!session.isEmailVerified &&
			!event.url.pathname.startsWith('/account/verify-email') &&
			!event.url.pathname.startsWith('/account/settings')
		) {
			return redirect(302, '/account/verify-email');
		}
		if (
			event.url.pathname.startsWith('/account/login') ||
			event.url.pathname.startsWith('/account/signup')
		) {
			return redirect(302, '/account');
		}
	} else {
		if (
			event.url.pathname.startsWith('/account') &&
			event.url.pathname !== '/account/login' &&
			event.url.pathname !== '/account/signup' &&
			event.url.pathname !== '/account/reset-password' &&
			event.url.pathname !== '/account/request-password-reset'
		) {
			return redirect(302, '/account/login');
		}
		deleteSessionTokenCookie(event);
	}

	event.locals.session = session;

	return resolve(event);
};

export const handle = sequence(authHandle);
