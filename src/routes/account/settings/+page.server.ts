import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoadEvent } from './$types';
import { msg } from '$lib/msg';
import { hashPassword, isStrongPassword, verifyPasswordHash } from '$lib/server/auth/password';
import { isEmailAvailable } from '$lib/server/auth/email';
import { db } from '$lib/server/db';
import { generateRandomOTP } from '$lib/server/auth/utils';
import { MINUTE } from '$lib/util/time';
import { sendMail } from '$lib/server/sendMail';
import EmailVerification from '$lib/server/email/EmailVerification.svelte';
import { deleteSessionTokenCookie, invalidateSession } from '$lib/server/auth/session';
import { verifyPhone } from '$lib/server/verifyPhone';
import { getUserPasswordHash } from '$lib/server/auth/user';

export function load(event: PageServerLoadEvent) {
	return {
		email: event.locals.session!.email,
		phone: event.locals.session!.phone
	};
}

export const actions: Actions = {
	changePassword: async function verifyCode(event: RequestEvent) {
		const userId = event.locals.session!.userId;
		const formData = await event.request.formData();
		const newPassword = formData.get('newPassword');
		const oldPassword = formData.get('oldPassword');
		if (typeof newPassword !== 'string' || newPassword === '') {
			return fail(400, { msg: msg('enterNewPassword') });
		}
		if (typeof oldPassword !== 'string' || oldPassword === '') {
			return fail(400, { msg: msg('enterOldPassword') });
		}
		if (!(await isStrongPassword(newPassword))) {
			return fail(400, { msg: msg('weakPassword') });
		}
		const oldPasswordHash = await getUserPasswordHash(userId);
		if (!(await verifyPasswordHash(oldPasswordHash, oldPassword))) {
			return fail(400, { msg: msg('invalidOldPassword') });
		}
		const passwordHash = await hashPassword(newPassword);
		await db
			.updateTable('user')
			.where('user.id', '=', event.locals.session!.userId!)
			.set({ passwordHash })
			.execute();
		return { msg: msg('passwordChanged', 'success') };
	},

	changeEmail: async function resendEmail(event: RequestEvent) {
		const formData = await event.request.formData();
		const email = formData.get('email');
		if (typeof email !== 'string' || email === '') {
			return fail(400, { msg: msg('enterEmail'), email: '' });
		}
		if (event.locals.session?.email == email) {
			return fail(400, { msg: msg('oldEmail'), email });
		}
		if (!(await isEmailAvailable(email))) {
			return fail(400, { msg: msg('emailAlreadyRegistered'), email });
		}

		// Update e-mail address.
		const user = await db
			.updateTable('user')
			.set({
				email,
				emailVerificationCode: generateRandomOTP(),
				emailVerificationExpiresAt: Date.now() + 10 * MINUTE,
				isEmailVerified: false
			})
			.where('id', '=', event.locals.session!.userId)
			.returningAll()
			.executeTakeFirstOrThrow();

		// Send verification email.
		try {
			await sendMail(EmailVerification, 'Email Verifikation', email, {
				code: user.emailVerificationCode,
				name: user.name
			});
		} catch {
			return fail(500, { msg: msg('failedToSendVerificationEmail'), email });
		}

		return { msg: msg('checkInboxToVerify', 'success') };
	},

	changePhone: async function changePhone(event: RequestEvent) {
		const phone = verifyPhone((await event.request.formData()).get('phone'));
		if (phone != null && typeof phone !== 'string') {
			return phone;
		}
		await db
			.updateTable('user')
			.where('user.id', '=', event.locals.session!.userId!)
			.set({ phone })
			.execute();
		return { msg: msg('phoneChanged', 'success') };
	},

	logout: async (event: RequestEvent) => {
		await invalidateSession(event.locals.session!.id);
		deleteSessionTokenCookie(event);
		return redirect(302, '/');
	}
};
