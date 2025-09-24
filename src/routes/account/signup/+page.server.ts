import { fail, redirect } from '@sveltejs/kit';
import { RefillingTokenBucket } from '$lib/server/auth/rate-limit';
import { hashPassword, isStrongPassword } from '$lib/server/auth/password';
import {
	createSession,
	generateSessionToken,
	setSessionTokenCookie
} from '$lib/server/auth/session';
import { MINUTE } from '$lib/util/time';
import { db } from '$lib/server/db';
import { generateRandomOTP } from '$lib/server/auth/utils';
import { verifyEmailInput, isEmailAvailable } from '$lib/server/auth/email';
import { msg } from '$lib/msg';
import { sendMail } from '$lib/server/sendMail';
import Welcome from '$lib/server/email/Welcome.svelte';
import type { Actions, PageServerLoadEvent, RequestEvent } from './$types';
import { getIp } from '$lib/server/getIp';
import { PUBLIC_PROVIDER } from '$env/static/public';
import { verifyPhone } from '$lib/server/verifyPhone';

const ipBucket = new RefillingTokenBucket<string>(3, 10);

async function createUser(
	name: string,
	firstName: string,
	gender: string,
	email: string,
	password: string,
	zipCode: string,
	city: string,
	region: string,
	phone: string | null
) {
	const passwordHash = await hashPassword(password);
	return await db
		.insertInto('user')
		.values({
			name,
			email,
			passwordHash,
			isEmailVerified: false,
			emailVerificationCode: generateRandomOTP(),
			emailVerificationExpiresAt: Date.now() + 10 * MINUTE,
			passwordResetCode: null,
			phone,
			companyId: null,
			isTaxiOwner: false,
			isAdmin: false,
			firstName,
			gender,
			zipCode,
			city,
			region,
			isService: false
		})
		.returningAll()
		.executeTakeFirstOrThrow();
}

export function load(event: PageServerLoadEvent) {
	if (event.locals.session) {
		return redirect(302, '/account');
	}
}

export const actions: Actions = {
	default: async (event: RequestEvent) => {
		const clientIP = getIp(event);
		if (!ipBucket.check(clientIP, 1)) {
			return fail(429, { msg: msg('tooManyRequests'), email: '' });
		}

		const formData = await event.request.formData();
		const firstName = formData.get('firstname');
		const gender = formData.get('gender');
		const name = formData.get('lastname');
		const email = formData.get('email');
		const password = formData.get('password');
		const zipCode = formData.get('zipcode');
		const city = formData.get('city');
		const region = formData.get('region');
		const phone = verifyPhone(formData.get('phone'));
		if (
			typeof name !== 'string' ||
			name.length < 2 ||
			typeof firstName !== 'string' ||
			firstName.length < 2 ||
			typeof email !== 'string' ||
			email.length < 5 ||
			typeof password !== 'string' ||
			password.length < 3 ||
			typeof gender !== 'string' ||
			gender.length != 1
		) {
			return fail(400, { msg: msg('enterEmailAndPassword'), email: '' });
		}
		if (
			typeof zipCode !== 'string' ||
			zipCode.length < 2 ||
			typeof city !== 'string' ||
			city.length < 1 ||
			typeof region !== 'string' ||
			region.length < 1
		) {
			return fail(400, { msg: msg('invalidZipCity'), email });
		}
		if (!verifyEmailInput(email)) {
			return fail(400, { msg: msg('invalidEmail'), email });
		}
		if (!(await isEmailAvailable(email))) {
			return fail(400, { msg: msg('emailAlreadyRegistered'), email });
		}
		if (!(await isStrongPassword(password))) {
			return fail(400, { msg: msg('weakPassword'), email });
		}
		if (!ipBucket.consume(clientIP, 1)) {
			return fail(429, { msg: msg('tooManyRequests'), email });
		}
		if (phone != null && typeof phone !== 'string') {
			return phone;
		}
		const user = await createUser(
			name,
			firstName,
			gender,
			email,
			password,
			zipCode,
			city,
			region,
			phone
		);
		try {
			await sendMail(Welcome, `Willkommen zu ${PUBLIC_PROVIDER}`, email, {
				code: user.emailVerificationCode
			});
		} catch {
			console.log('failed to send email');
		}
		const sessionToken = generateSessionToken();
		const session = await createSession(sessionToken, user.id);
		setSessionTokenCookie(event, sessionToken, new Date(session.expiresAt));
		return redirect(302, '/account');
	}
};
