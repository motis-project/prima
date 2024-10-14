import { migrateToLatest } from '$lib/migrate';
import { lucia } from '$lib/auth';
import { db } from '$lib/database';
import { redirect, type Handle } from '@sveltejs/kit';

migrateToLatest(db);

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get(lucia.sessionCookieName);
	if (!sessionId) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const { session, user } = await lucia.validateSession(sessionId);
	if (session && session.fresh) {
		const sessionCookie = lucia.createSessionCookie(session.id);
		event.cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});
	}
	if (!session) {
		const sessionCookie = lucia.createBlankSessionCookie();
		event.cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});
	}

	event.locals.user = user;
	event.locals.session = session;

	if (event.route.id?.startsWith('/(user)') && (!user || !user.is_entrepreneur || !user.company)) {
		return redirect(302, '/login');
	}

	return resolve(event);
};
