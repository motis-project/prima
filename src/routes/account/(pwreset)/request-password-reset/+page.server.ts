import { fail, redirect } from '@sveltejs/kit';
import { verifyEmailInput } from '$lib/server/auth/email';
import { RefillingTokenBucket } from '$lib/server/auth/rate-limit';
import { generateRandomOTP } from '$lib/server/auth/utils';
import { MINUTE } from '$lib/util/time';
import { msg } from '$lib/msg';
import { getIp } from '$lib/server/getIp';
import { db } from '$lib/server/db';
import type { Actions, RequestEvent } from './$types';
import { sendMail } from '$lib/server/sendMail';
import PasswordReset from '$lib/server/email/PasswordReset.svelte';

const ipBucket = new RefillingTokenBucket<string>(3, 60);
const emailBucket = new RefillingTokenBucket<string>(3, 60);

export const actions: Actions = {
	default: async (event: RequestEvent) => {
		const clientIP = getIp(event);
		if (!ipBucket.check(clientIP, 1)) {
			return fail(429, { msg: msg('tooManyRequests') });
		}

		const formData = await event.request.formData();
		const email = formData.get('email');
		if (typeof email !== 'string' || !verifyEmailInput(email)) {
			return fail(400, { msg: msg('invalidEmail'), email });
		}
		if (!ipBucket.consume(clientIP, 1) || !emailBucket.consume(email, 1)) {
			return fail(400, { msg: msg('tooManyRequests'), email });
		}

		const user = await db
			.updateTable('user')
			.set({
				passwordResetCode: generateRandomOTP(),
				passwordResetExpiresAt: Date.now() + 10 * MINUTE
			})
			.where('email', '=', email)
			.returningAll()
			.executeTakeFirst();
		if (!user) {
			return fail(400, { msg: msg('accountDoesNotExist'), email });
		}

		try {
			await sendMail(PasswordReset, 'Passwort zurücksetzen', email, {
				code: user.passwordResetCode,
				name: user.firstName + ' ' + user.name,
				email
			});
		} catch {
			return fail(500, { msg: msg('failedToSendVerificationEmail'), email });
		}

		return redirect(302, '/account/reset-password');
	}
};
