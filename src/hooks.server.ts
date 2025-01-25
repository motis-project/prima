import { RefillingTokenBucket } from '$lib/server/auth/rate-limit';
import {
	validateSessionToken,
	setSessionTokenCookie,
	deleteSessionTokenCookie
} from '$lib/server/auth/session';
import { sequence } from '@sveltejs/kit/hooks';
import { getIp } from '$lib/server/getIp';
import { redirect, type Handle } from '@sveltejs/kit';

const bucket = new RefillingTokenBucket<string>(100, 1);

const rateLimitHandle: Handle = async ({ event, resolve }) => {
	const clientIP = getIp(event);
	if (!clientIP) {
		return resolve(event);
	}
	let cost: number;
	if (event.request.method === 'GET' || event.request.method === 'OPTIONS') {
		cost = 1;
	} else {
		cost = 3;
	}
	if (!bucket.consume(clientIP, cost)) {
		console.log('too many requests from', clientIP);
		return new Response('Too many requests', {
			status: 429
		});
	}
	return resolve(event);
};

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

export const handle = sequence(rateLimitHandle, authHandle);
