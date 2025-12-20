import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from '@oslojs/encoding';
import { sha256 } from '@oslojs/crypto/sha2';

import type { RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { DAY } from '$lib/util/time';

export type Session = Awaited<ReturnType<typeof validateSessionToken>>;

export async function validateSessionToken(token: string | undefined) {
	if (!token) {
		return null;
	}

	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
	const session = await db
		.selectFrom('session')
		.innerJoin('user', 'session.userId', 'user.id')
		.select([
			'session.id',
			'session.userId',
			'session.expiresAt',
			'user.name',
			'user.phone',
			'user.email',
			'user.isEmailVerified',
			'user.emailVerificationCode',
			'user.emailVerificationExpiresAt',
			'user.isAdmin',
			'user.isTaxiOwner',
			'user.isService',
			'user.companyId'
		])
		.where('session.id', '=', sessionId)
		.executeTakeFirst();

	if (!session) {
		return null;
	}

	// Session expired? Delete session.
	if (Date.now() >= session.expiresAt) {
		await db.deleteFrom('session').where('id', '=', session.id).execute();
		return null;
	}

	// Session valid. Extend session by 30 days if less than 15 days left.
	if (Date.now() >= session.expiresAt - 15 * DAY) {
		session.expiresAt = Date.now() + 30 * DAY;
		await db
			.updateTable('session')
			.set({ expiresAt: session.expiresAt })
			.where('id', '=', session.id)
			.execute();
	}

	return session;
}

export function setSessionTokenCookie(event: RequestEvent, token: string, expiresAt: Date) {
	event.cookies.set('session', token, {
		httpOnly: true,
		path: '/',
		secure: import.meta.env.PROD,
		sameSite: 'lax',
		expires: expiresAt
	});
}

export function deleteSessionTokenCookie(event: RequestEvent) {
	event.cookies.set('session', '', {
		httpOnly: true,
		path: '/',
		secure: import.meta.env.PROD,
		sameSite: 'lax',
		maxAge: 0
	});
}

export async function invalidateSession(id: string) {
	await db.deleteFrom('session').where('id', '=', id).execute();
}

export function generateSessionToken(): string {
	const tokenBytes = new Uint8Array(20);
	crypto.getRandomValues(tokenBytes);
	return encodeBase32LowerCaseNoPadding(tokenBytes).toLowerCase();
}

export async function createSession(token: string, userId: number) {
	const session = {
		id: encodeHexLowerCase(sha256(new TextEncoder().encode(token))),
		expiresAt: Date.now() + 30 * DAY,
		userId
	};
	await db.insertInto('session').values(session).executeTakeFirst();
	return session;
}
