import { error, fail, redirect } from '@sveltejs/kit';
import { verifyEmailInput } from '$lib/server/auth/email';
import { getUserFromEmail, getUserPasswordHash } from '$lib/server/auth/user';
import { RefillingTokenBucket, Throttler } from '$lib/server/auth/rate-limit';
import { verifyPasswordHash } from '$lib/server/auth/password';
import {
	createSession,
	generateSessionToken,
	setSessionTokenCookie
} from '$lib/server/auth/session';
import { msg, type Msg } from '$lib/msg';
import { getIp } from '$lib/server/getIp';
import type { RequestEvent } from '@sveltejs/kit';

const throttler = new Throttler<number>([0, 1, 2, 4, 8, 16, 30, 60, 180, 300]);
const ipBucket = new RefillingTokenBucket<string>(20, 1);

export enum LoginInto {
	PRIMA_MAIN,
	PRIMA_DRIVER
}

function getErrorReturn(into: LoginInto, code: number, msg?: { msg: Msg; email?: string }) {
	return into === LoginInto.PRIMA_DRIVER ? error(code) : fail(code, msg!);
}

export async function login(event: RequestEvent, into: LoginInto) {
	const errorFn = into === LoginInto.PRIMA_DRIVER ? error : fail;
	const clientIP = getIp(event);
	if (!ipBucket.check(clientIP, 1)) {
		return getErrorReturn(into, 429, { msg: msg('tooManyRequests') });
	}
	const formData = await event.request.formData();
	const email = formData.get('email');
	const password = formData.get('password');
	if (
		typeof email !== 'string' ||
		typeof password !== 'string' ||
		email === '' ||
		password === ''
	) {
		return getErrorReturn(into, 400, { msg: msg('enterEmailAndPassword') });
	}
	if (!verifyEmailInput(email)) {
		return getErrorReturn(into, 400, { msg: msg('invalidEmail'), email });
	}
	const user = await getUserFromEmail(email);
	if (!user) {
		return getErrorReturn(into, 400, { msg: msg('accountDoesNotExist'), email });
	}
	if (clientIP !== null && !ipBucket.consume(clientIP, 1)) {
		return getErrorReturn(into, 429, { msg: msg('tooManyRequests'), email });
	}
	if (!throttler.consume(user.id)) {
		return getErrorReturn(into, 429, { msg: msg('tooManyRequests'), email });
	}
	const passwordHash = await getUserPasswordHash(user.id);
	const validPassword = await verifyPasswordHash(passwordHash, password);
	if (!validPassword) {
		return getErrorReturn(into, 400, { msg: msg('invalidPassword'), email });
	}
	if (into === LoginInto.PRIMA_DRIVER && user.companyId === null) {
		return error(403);
	}
	throttler.reset(user.id);
	const sessionToken = generateSessionToken();
	const session = await createSession(sessionToken, user.id);
	setSessionTokenCookie(event, sessionToken, new Date(session.expiresAt));
	if (user.isTaxiOwner) {
		return redirect(303, '/taxi/availability');
	} else {
		return redirect(303, '/routing');
	}
}
