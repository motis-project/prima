import { db } from '$lib/server/db';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

export const load: PageServerLoad = async (event) => {
	const people = await db
		.selectFrom('user')
		.where('companyId', '=', event.locals.session!.companyId!)
		.selectAll()
		.execute();
	return {
		owners: people.filter((p) => p.isTaxiOwner),
		drivers: people.filter((p) => !p.isTaxiOwner),
		userEmail: event.locals.session?.email
	};
};

export const actions = {
	assignDriver: async (event: RequestEvent) => {
		const email = (await event.request.formData()).get('email')!.toString();
		const companyId = event.locals.session!.companyId!;
		if (!email) {
			return fail(400, { driver: { email, missing: true } });
		}
		const { numUpdatedRows } = await db
			.updateTable('user')
			.set({ companyId })
			.where('email', '=', email)
			.where('companyId', 'is', null)
			.where('isTaxiOwner', '=', false)
			.where('isAdmin', '=', false)
			.executeTakeFirstOrThrow();
		if (numUpdatedRows == BigInt(0)) {
			return fail(400, { driver: { email, incorrect: true } });
		}
		return { driver: { updated: true } };
	},

	revokeDriver: async (event: RequestEvent) => {
		const email = (await event.request.formData()).get('email')!.toString();
		const companyId = event.locals.session!.companyId!;
		await db
			.updateTable('user')
			.set({
				isTaxiOwner: false,
				companyId: null
			})
			.where('companyId', '=', companyId)
			.where('email', '=', email)
			.executeTakeFirst();
	},

	assignOwner: async (event: RequestEvent) => {
		const email = (await event.request.formData()).get('email')!.toString();
		const companyId = event.locals.session!.companyId!;
		if (!email) {
			return fail(400, { owner: { email, missing: true } });
		}
		const { numUpdatedRows } = await db
			.updateTable('user')
			.set({ companyId: companyId, isTaxiOwner: true })
			.where('email', '=', email)
			.where('isTaxiOwner', '=', false)
			.where('isAdmin', '=', false)
			.where((eb) => eb.or([eb('companyId', 'is', null), eb('companyId', '=', companyId)]))
			.executeTakeFirstOrThrow();
		if (numUpdatedRows == BigInt(0)) {
			return fail(400, { owner: { email, incorrect: true } });
		}
		return { owner: { updated: true } };
	},

	revokeOwner: async (event: RequestEvent) => {
		const email = (await event.request.formData()).get('email')!.toString();
		if (event.locals.session!.email == email) {
			return fail(400);
		}
		const companyId = event.locals.session!.companyId!;
		await db
			.updateTable('user')
			.set({ isTaxiOwner: false, companyId: null })
			.where('companyId', '=', companyId)
			.where('email', '=', email)
			.executeTakeFirst();
	}
} satisfies Actions;
