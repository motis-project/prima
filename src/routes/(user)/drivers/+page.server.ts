import type { Actions } from './$types';
import { db } from '$lib/database';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async (event) => {
	const drivers = await db
		.selectFrom('auth_user')
		.where('company_id', '=', event.locals.user!.company!)
		.where('is_entrepreneur', '=', false)
		.selectAll()
		.execute();
	return {
		drivers,
		userEmail: event.locals.user!.email
	};
};

export const actions = {
	assign: async (event) => {
		const email = (await event.request.formData()).get('email')!.toString();
		const companyId = event.locals.user!.company!;
		if (!email) {
			return fail(400, { email, missing: true });
		}
		try {
			const user = await db
				.selectFrom('auth_user')
				.where('email', '=', email)
				.selectAll()
				.executeTakeFirstOrThrow();
			if (user.company_id != null) {
				return { existed: true };
			}
			await db
				.updateTable('auth_user')
				.set({ company_id: companyId })
				.where('email', '=', email)
				.executeTakeFirst();
		} catch {
			return fail(400, { email, incorrect: true });
		}
		return { updated: true };
	},
	revoke: async (event) => {
		const email = (await event.request.formData()).get('email')!.toString();
		const companyId = event.locals.user!.company!;
		await db
			.updateTable('auth_user')
			.set({
				is_entrepreneur: false,
				company_id: null
			})
			.where('company_id', '=', companyId)
			.where('email', '=', email)
			.executeTakeFirst();
	}
} satisfies Actions;
