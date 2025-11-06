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
import { replacePhoto } from '$lib/server/util/uploadPhoto';
import { jsonArrayFrom } from 'kysely/helpers/postgres';

export async function load(event: PageServerLoadEvent) {
	const user = await db
		.selectFrom('user')
		.where('user.id', '=', event.locals.session!.userId)
		.select((eb) => [
			'user.email',
			'user.phone',
			'user.profilePicture',
			'user.name',
			'user.firstName',
			'user.gender',
			'user.zipCode',
			'user.city',
			'user.region',
			jsonArrayFrom(
				eb
					.selectFrom('rideShareVehicle')
					.whereRef('rideShareVehicle.owner', '=', 'user.id')
					.select([
						'rideShareVehicle.color',
						'rideShareVehicle.passengers',
						'rideShareVehicle.luggage',
						'rideShareVehicle.licensePlate',
						'rideShareVehicle.model',
						'rideShareVehicle.smokingAllowed',
						'rideShareVehicle.id'
					])
			).as('vehicles')
		])
		.executeTakeFirst();
	if (user === undefined) {
		error(404, { message: 'User not found' });
	}
	return {
		email: user.email,
		phone: user.phone,
		profilePicture: user.profilePicture,
		gender: user.gender,
		name: user.name,
		firstName: user.firstName,
		city: user.city,
		region: user.region,
		zipCode: user.zipCode,
		vehicles: user.vehicles
	};
}

export const actions: Actions = {
	changePassword: async function verifyCode(event: RequestEvent) {
		const userId = event.locals.session?.userId;
		if (!userId) {
			return fail(403);
		}
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
			.where('user.id', '=', event.locals.session!.userId)
			.set({ passwordHash })
			.execute();
		return { msg: msg('passwordChanged', 'success') };
	},

	changeEmail: async function resendEmail(event: RequestEvent) {
		const userId = event.locals.session?.userId;
		if (!userId) {
			return fail(403);
		}
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
			.where('id', '=', userId)
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
		const userId = event.locals.session!.userId!;
		if (!userId) {
			return fail(403);
		}
		const phone = verifyPhone((await event.request.formData()).get('phone'));
		if (phone != null && typeof phone !== 'string') {
			return phone;
		}
		await db.updateTable('user').where('user.id', '=', userId).set({ phone }).execute();
		return { msg: msg('phoneChanged', 'success') };
	},

	logout: async (event: RequestEvent) => {
		await invalidateSession(event.locals.session!.id);
		deleteSessionTokenCookie(event);
		return redirect(302, '/');
	},

	uploadProfilePicture: async (event) => {
		const userId = event.locals.session?.userId;
		if (!userId) {
			return fail(403);
		}
		const formData = await event.request.formData();
		const file = formData.get('profilePicture');
		const oldPhoto = await db
			.selectFrom('user')
			.where('user.id', '=', userId)
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
			.where('user.id', '=', userId)
			.set({ profilePicture: uploadResult })
			.execute();
	},

	personalInfo: async (event) => {
		const userId = event.locals.session?.userId;
		if (!userId) {
			return fail(403);
		}
		const formData = await event.request.formData();
		const gender = formData.get('gender');
		const firstName = formData.get('firstname');
		const lastName = formData.get('lastname');
		const city = formData.get('city');
		const region = formData.get('region');
		const zipCode = formData.get('zipcode');
		if (
			typeof gender !== 'string' ||
			typeof firstName !== 'string' ||
			typeof lastName !== 'string' ||
			typeof city !== 'string' ||
			typeof region !== 'string' ||
			typeof zipCode !== 'string'
		) {
			return fail(400);
		}
		await db
			.updateTable('user')
			.where('user.id', '=', userId)
			.set({ gender, firstName: firstName, name: lastName, city, region, zipCode })
			.execute();
	}
};
