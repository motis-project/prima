import { setAnonymousUserId } from '$lib/constants';
import {
	validateSessionToken,
	setSessionTokenCookie,
	deleteSessionTokenCookie
} from '$lib/server/auth/session';
import { db } from '$lib/server/db';
import { generateSecurePassword } from '$lib/server/util/generatePassword';
import { error, redirect, type Handle } from '@sveltejs/kit';
import { sql } from 'kysely';

let anonymousUserCreated = false;
const anonymousEmail = 'anonymous@abc.de';

const authHandle: Handle = async ({ event, resolve }) => {
	if (!anonymousUserCreated) {
		await db.transaction().execute(async (trx) => {
			await sql`LOCK TABLE "user" IN ACCESS EXCLUSIVE MODE;`.execute(trx);
			const existing = await trx
				.selectFrom('user')
				.select('id')
				.where('user.email', '=', anonymousEmail)
				.executeTakeFirst();
			if (!existing) {
				setAnonymousUserId(
					(
						await trx
							.insertInto('user')
							.values({
								email: anonymousEmail,
								name: 'Anonym',
								passwordHash: generateSecurePassword(16),
								isEmailVerified: false,
								isTaxiOwner: false,
								isAdmin: false
							})
							.returning('user.id')
							.executeTakeFirst()
					)?.id
				);
			} else {
				setAnonymousUserId(existing.id);
			}
			anonymousUserCreated = true;
		});
	}
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
