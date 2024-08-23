import type { Actions } from './$types';
import { db } from '$lib/database';
import { fail } from '@sveltejs/kit';

export const actions = {
	default: async ({ request }) => {
		const email = (await request.formData()).get('email')!.toString();
		const companyId = 0;
		if (!email) {
			return fail(400, { email, missing: true });
		}
		try {
			const user = await db
				.selectFrom('auth_user')
				.where('email', '=', email)
				.selectAll()
				.executeTakeFirstOrThrow();
			if (user.is_driver) {
				return { existed: true };
			}
			await db
				.updateTable('auth_user')
				.set({ company_id: companyId, is_driver: true })
				.where('email', '=', email)
				.executeTakeFirst();
		} catch {
			return fail(400, { email, incorrect: true });
		}
		return { updated: true };
	}
} satisfies Actions;
