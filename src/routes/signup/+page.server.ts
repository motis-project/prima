import { fail, redirect } from '@sveltejs/kit';
import { generateId } from 'lucia';
import { hash } from '@node-rs/argon2';
import { db } from '$lib/database';
import { lucia } from '$lib/auth';
import type { Actions } from './$types';

import { Html, Head, Preview, Section, Container, Text } from 'svelte-email';
import { render } from 'svelte-email';
import Welcome from '$lib/WelcomeEmail.svelte';
import nodemailer from 'nodemailer';

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email');
		const password = formData.get('password');
		if (typeof email !== 'string' || email.length > 100 || !/.+@.+/.test(email)) {
			return fail(400, {
				message: 'Invalid email'
			});
		}
		if (typeof password !== 'string' || password.length < 6 || password.length > 255) {
			return fail(400, {
				message: 'Invalid password'
			});
		}

		const password_hash = await hash(password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});
		const id = generateId(15);
		const first_name = null;
		const last_name = null;
		const phone = null;
		const company_id = null;

		try {
			await db
				.insertInto('auth_user')
				.values({ id, email, password_hash, is_entrepreneur: false, is_maintainer: false })
				.values({
					id,
					email,
					password_hash,
					first_name,
					last_name,
					phone,
					company_id,
					is_entrepreneur: false,
					is_maintainer: false
				})
				.executeTakeFirst();

			const session = await lucia.createSession(id, {});
			const sessionCookie = lucia.createSessionCookie(session.id);
			event.cookies.set(sessionCookie.name, sessionCookie.value, {
				path: '.',
				...sessionCookie.attributes
			});
		} catch (e: unknown) {
			// @ts-expect-error: 'e' is of type 'unknown'
			if (e['constraint'] === 'auth_user_email_key') {
				return fail(400, {
					message: 'email already used'
				});
			}
			return fail(500, {
				message: 'An unknown error occurred'
			});
		}

		// Error: user passwort from email
		try {
			const transporter = nodemailer.createTransport({
				host: 'smtp.ethereal.email',
				port: 587,
				secure: false,
				auth: {
					user: 'my_user',
					pass: 'my_password'
				}
			});
			const mailOptions = {
				from: 'you@example.com',
				to: email,
					subject: 'Welcome email',
					Welcome
				};
			console.log("hi?");
			await transporter.sendMail(mailOptions);
			console.log("geschafft?");
		} catch (error) {
			console.error('Error sending welcome email:', error);
		}

		return redirect(302, '/');
	}
};
