import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/database';
import { lucia } from '$lib/auth';
import type { Actions, PageServerLoad } from './$types';

import OTP from '$lib/OneTimePassEmail.svelte';
import nodemailer from 'nodemailer';

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		console.log("where am I");
		return redirect(302, '/');
	}
	return {};
};

// error, zeigt nicht die richtige seite an
// hydration_mismatch Hydration failed because the initial UI does not match what was rendered on the server

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email');

		if (typeof email !== 'string' || email.length > 100 || !/.+@.+/.test(email)) {
			return fail(400, {
				message: 'Invalid email'
			});
		}

		const existingUser = await db
			.selectFrom('auth_user')
			.selectAll()
			.where('email', '=', email)
			.executeTakeFirst();
		if (!existingUser) {
			return fail(400, {
				message: 'Incorrect email'
			});
		}

		const session = await lucia.createSession(existingUser.id, {});
		const sessionCookie = lucia.createSessionCookie(session.id);
		event.cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});

        // send one time password
        try {
			const transporter = nodemailer.createTransport({
				host: 'smtp. .de',
				port: 587,
				secure: false,
				auth: {
					user: 'user',
					pass: 'passwort'
				},
				tls: {
					rejectUnauthorized: true,
					ciphers:'SSLv3'
				}
			});
			const mailOptions = {
				from: 'mail address',
				to: email,
					subject: 'Welcome email',
					OTP
				};
			console.log("hi?");
			//await transporter.sendMail(mailOptions);
			console.log("geschafft?");
		} catch (error) {
			console.error('Error sending otp email:', error);
		}

		return redirect(302, '/forgotpassword/otp');
	}
};
