import { fail, redirect } from '@sveltejs/kit';
import { generateId } from 'lucia';
import { hash } from '@node-rs/argon2';
import { db } from '$lib/database';
import { lucia } from '$lib/auth';
import type { Actions } from './$types';

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

		try {
			await db
				.insertInto('auth_user')
				.values({ id, email, password_hash, is_entrepreneur: false, is_maintainer: false })
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
		return redirect(302, '/taxi');
	}
};
