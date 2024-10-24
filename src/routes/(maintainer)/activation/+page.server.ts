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
			const user = await db
				.selectFrom('auth_user')
				.where('email', '=', email)
				.selectAll()
				.executeTakeFirstOrThrow();
			if (user.is_entrepreneur) {
				return { existed: true };
			}
			const companyId = (await db
				.insertInto('company')
				.values({
					latitude: null,
					longitude: null,
					name: null,
					street: null,
					house_number: null,
					postal_code: null,
					city: null,
					zone: null,
					community_area: null
				})
				.returning('company.id')
				.executeTakeFirst())!.id;
			await db
				.updateTable('auth_user')
				.set({ company_id: companyId, is_entrepreneur: true })
				.where('email', '=', email)
				.executeTakeFirst();
		} catch {
			return fail(400, { email, incorrect: true });
		}
		return { updated: true };
	}
} satisfies Actions;
