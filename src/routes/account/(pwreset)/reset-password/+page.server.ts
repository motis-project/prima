import { fail, redirect } from '@sveltejs/kit';
import { verifyEmailInput } from '$lib/server/auth/email';
import { RefillingTokenBucket } from '$lib/server/auth/rate-limit';
import type { Actions, PageServerLoadEvent, RequestEvent } from './$types';
import { msg } from '$lib/msg';
import { getIp } from '$lib/server/getIp';
import { db } from '$lib/server/db';
import { hashPassword, isStrongPassword } from '$lib/server/auth/password';

export function load(event: PageServerLoadEvent) {
	return {
		code: event.url.searchParams.get('code'),
		email: event.url.searchParams.get('email')
	};
}

const ipBucket = new RefillingTokenBucket<string>(3, 60);
const emailBucket = new RefillingTokenBucket<string>(3, 60);

export const actions: Actions = {
	default: async (event: RequestEvent) => {
		const clientIP = getIp(event);
		if (clientIP !== null && !ipBucket.check(clientIP, 1)) {
			return fail(429, { msg: msg('tooManyRequests') });
		}

		const formData = await event.request.formData();
		const email = formData.get('email');
		const code = formData.get('code');
		const password = formData.get('password');

		if (typeof code !== 'string') {
			return fail(400, { msg: msg('enterYourCode'), email });
		}
		if (typeof email !== 'string' || !verifyEmailInput(email)) {
			return fail(400, { msg: msg('invalidEmail'), email, code });
		}
		if (typeof password !== 'string') {
			return fail(400, { msg: msg('enterEmailAndPassword'), email, code });
		}
		if (!(await isStrongPassword(password))) {
			return fail(400, { msg: msg('weakPassword'), email, code });
		}
		if (!ipBucket.consume(clientIP, 1)) {
			return fail(400, { msg: msg('tooManyRequests'), email, code });
		}
		if (!emailBucket.consume(email, 1)) {
			return fail(400, { msg: msg('tooManyRequests'), email, code });
		}

		const passwordHash = await hashPassword(password);
		const success = await db
			.updateTable('user')
			.set({
				passwordHash,
				passwordResetCode: null,
				passwordResetExpiresAt: null
			})
			.where('email', '=', email)
			.where('passwordResetCode', '=', code)
			.where('passwordResetExpiresAt', '>=', Date.now())
			.executeTakeFirst();

		if (success.numUpdatedRows === BigInt(0)) {
			return fail(400, { msg: msg('incorrectCode'), email, code });
		}

		return redirect(302, '/account/login?passwordResetSuccess');
	}
};
