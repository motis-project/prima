import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
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
import { readInt } from '$lib/server/util/readForm';
import { LICENSE_PLATE_REGEX } from '$lib/constants';
import { createRideShareVehicle } from '$lib/server/booking';
import { replacePhoto } from '$lib/server/util/uploadPhoto';

export async function load(event: PageServerLoadEvent) {
	const user = await db
		.selectFrom('user')
		.where('user.id', '=', event.locals.session!.userId)
		.select(['user.email', 'user.phone', 'user.profilePicture'])
		.executeTakeFirst();
	if (user === undefined) {
		error(404, { message: 'User not found' });
	}
	return {
		email: user.email,
		phone: user.phone,
		profilePicture: user.profilePicture
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
				name: user.firstName + ' ' + user.name
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
	},

	addVehicle: async function (event: RequestEvent) {
		const user = event.locals.session?.userId;
		if (!user) {
			throw 'user not defined';
		}

		const formData = await event.request.formData();
		const licensePlate = formData.get('licensePlate');
		const color = formData.get('color');
		const hasColorString = formData.get('hasColorString');
		const model = formData.get('model');
		const hasModelString = formData.get('hasModelString');
		const smokingAllowedString = formData.get('smokingAllowed');
		const luggage = readInt(formData.get('luggage'));
		const passengers = readInt(formData.get('passengers'));
		const vehiclePicture = formData.get('vehiclePicture');

		if (passengers !== 1 && passengers !== 2 && passengers !== 3 && passengers !== 4) {
			return fail(400, { msg: msg('invalidSeats') });
		}

		if (typeof licensePlate !== 'string' || !LICENSE_PLATE_REGEX.test(licensePlate)) {
			return fail(400, { msg: msg('invalidLicensePlate') });
		}

		if (typeof color !== 'string') {
			return fail(400);
		}

		if (typeof model !== 'string') {
			return fail(400);
		}

		if (smokingAllowedString !== null && typeof smokingAllowedString !== 'string') {
			return fail(400);
		}

		if (typeof hasColorString !== 'string') {
			return fail(400);
		}

		if (typeof hasModelString !== 'string') {
			return fail(400);
		}
		const smokingAllowed = smokingAllowedString === '1';
		const hasColor = hasColorString === '1';
		const hasModel = hasModelString === '1';

		if (isNaN(luggage) || luggage <= 0 || luggage >= 11) {
			return fail(400, { msg: msg('invalidStorage') });
		}

		let vehiclePicturePath: string | null = null;
		if (vehiclePicture !== null) {
			const uploadResult = await replacePhoto(
				user,
				vehiclePicture,
				'/uploads/vehicle_pictures',
				null
			);
			if (typeof uploadResult !== 'string') {
				return uploadResult;
			}
			vehiclePicturePath = uploadResult;
		}
		console.log(
			'created ride share vehicle',
			await createRideShareVehicle(
				user,
				luggage,
				passengers,
				hasColor ? color : null,
				hasModel ? model : null,
				smokingAllowed,
				licensePlate,
				vehiclePicturePath
			)
		);
	},

	uploadProfilePicture: async (event) => {
		const userId = event.locals.session?.userId;
		const formData = await event.request.formData();
		const file = formData.get('profilePicture');
		const oldPhoto = await db
			.selectFrom('user')
			.where('user.id', '=', userId!)
			.select(['user.profilePicture'])
			.executeTakeFirst();
		const uploadResult = await replacePhoto(
			userId,
			file,
			'/uploads/profile_pictures',
			oldPhoto?.profilePicture ?? null
		);
		if (!(typeof uploadResult === 'string')) {
			return uploadResult;
		}

		await db
			.updateTable('user')
			.where('id', '=', userId!)
			.set({ profilePicture: uploadResult })
			.execute();
	}
};
