import type { Actions } from './$types';
import { db } from '$lib/database';
import { fail } from '@sveltejs/kit';

export const actions = {
	default: async ({ request }) => {
		const email = (await request.formData()).get('email')!.toString();
		if (!email) {
			return fail(400, { email, missing: true });
		}
		try {
			const updateResult = await db
				.updateTable('auth_user')
				.set({
					is_entrepreneur: true
				})
				.where('email', '=', email)
				.executeTakeFirstOrThrow();
			if (updateResult.numUpdatedRows == 0n) {
				return fail(400, { email, incorrect: true });
			}
		} catch {
			return fail(400, { email, incorrect: true });
		}
	}
} satisfies Actions;
