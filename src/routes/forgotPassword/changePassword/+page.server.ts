import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/database';
import type { Actions } from '././$types';
import { hash } from '@node-rs/argon2';
import { lucia } from '$lib/auth';


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
        const password_hash = await hash(password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});
        try {
			await db
				.updateTable("auth_user")
				.set({password_hash: password_hash})
				.where('id', '=', existingUser.id)
				.executeTakeFirst();
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

		// oder hier? 
		const session = await lucia.createSession(existingUser.id, {});
		const sessionCookie = lucia.createSessionCookie(session.id);
		event.cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});

		return redirect(302, '/');
	}
};
