import type { Actions } from './$types';
import { db } from '$lib/database';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import type { RequestEvent } from './$types';

export const load: PageServerLoad = async (event) => {
	const administrators = await db
		.selectFrom('auth_user')
		.where('company_id', '=', event.locals.user!.company!)
		.where('is_entrepreneur', '=', true)
		.selectAll()
		.execute();
	return {
		administrators,
		userEmail: event.locals.user!.email
	};
};

export const actions = {
	assign: async (event: RequestEvent) => {
		const email = (await event.request.formData()).get('email')!.toString();
		const companyId = event.locals.user!.company!;
		if (!email) {
			return fail(400, { email, missing: true });
		}
		const { numUpdatedRows } = await db
			.updateTable('auth_user')
			.set({
				company_id: companyId,
				is_entrepreneur: true
			})
			.where('email', '=', email)
			.where('company_id', 'is', null)
			.where('is_entrepreneur', '=', false)
			.where('is_maintainer', '=', false)
			.executeTakeFirstOrThrow();
		if (numUpdatedRows == BigInt(0)) {
			return fail(400, { email, incorrect: true });
		}
		return { updated: true };
	},

	revoke: async (event: RequestEvent) => {
		const email = (await event.request.formData()).get('email')!.toString();
		if (event.locals.user!.email == email) {
			return fail(400);
		}
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
