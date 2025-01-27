import { fail, redirect } from '@sveltejs/kit';
import { ExpiringTokenBucket } from '$lib/server/auth/rate-limit';
import type { Actions, RequestEvent } from './$types';
import { MINUTE } from '$lib/util/time';
import { db } from '$lib/server/db';
import { generateRandomOTP } from '$lib/server/auth/utils';
import { msg } from '$lib/msg';
import { sendMail } from '$lib/server/sendMail';
import Welcome from '$lib/server/email/Welcome.svelte';
import { PUBLIC_PROVIDER } from '$env/static/public';

const bucket = new ExpiringTokenBucket<number>(5, 60 * 30);
const sendVerificationEmailBucket = new ExpiringTokenBucket<number>(3, 60 * 10);

async function updateEmailVerificationCode(userId: number) {
	return (
		await db
			.updateTable('user')
			.set({
				emailVerificationCode: generateRandomOTP(),
				emailVerificationExpiresAt: new Date(Date.now() + 10 * MINUTE)
			})
			.where('id', '=', userId)
			.returning('emailVerificationCode')
			.executeTakeFirstOrThrow()
	).emailVerificationCode;
}

export async function load(event: RequestEvent) {
	if (event.locals.session!.isEmailVerified) {
		return redirect(302, '/user');
	}
	return {
		email: event.locals.session!.email,
		code: event.url.searchParams.get('code')
	};
}

export const actions: Actions = {
	verify: async function verifyCode(event: RequestEvent) {
		if (!bucket.check(event.locals.session!.userId, 1)) {
			return fail(429, { msg: msg('tooManyRequests') });
		}

		const code = (await event.request.formData()).get('code');
		if (typeof code !== 'string' || code === '') {
			return fail(400, { msg: msg('enterYourCode') });
		}

		if (Date.now() >= event.locals.session!.expiresAt.getTime()) {
			const code = await updateEmailVerificationCode(event.locals.session!.userId);
			try {
				await sendMail(Welcome, `Willkommen zu ${PUBLIC_PROVIDER}`, event.locals.session!.email, {
					code
				});
			} catch {
				return fail(500, { msg: msg('failedToSendVerificationEmail') });
			}
			return { msg: msg('codeExpiredSentAnother') };
		}

		if (event.locals.session!.emailVerificationCode !== code) {
			return fail(400, { msg: msg('incorrectCode') });
		}

		await db
			.updateTable('user')
			.set({ isEmailVerified: true })
			.where('user.id', '=', event.locals.session!.userId)
			.execute();

		return redirect(302, '/account/settings');
	},

	resend: async function resendEmail(event: RequestEvent) {
		if (!sendVerificationEmailBucket.check(event.locals.session!.userId, 1)) {
			return fail(429, { msg: msg('tooManyRequests') });
		}
		const code = await updateEmailVerificationCode(event.locals.session!.userId);
		try {
			await sendMail(Welcome, `Willkommen zu ${PUBLIC_PROVIDER}`, event.locals.session!.email, {
				code
			});
		} catch {
			return fail(500, { msg: msg('failedToSendVerificationEmail') });
		}
		return { msg: msg('newCodeSent', 'success') };
	}
};
