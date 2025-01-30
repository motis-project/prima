import { msg } from '$lib/msg.js';
import { db } from '$lib/server/db';
import { fail } from '@sveltejs/kit';

export const actions = {
	default: async ({ request }) => {
		const email = (await request.formData()).get('email')!.toString();
		if (!email) {
			return fail(400, { msg: msg('invalidEmail'), email });
		}

		// Find user.
		const user = await db
			.selectFrom('user')
			.where('email', '=', email)
			.selectAll()
			.executeTakeFirst();
		if (!user) {
			return fail(400, { msg: msg('userDoesNotExist'), email });
		}

		if (user.isAdmin) {
			// Prevent admin from downgrade to taxi owner.
			return fail(400, { msg: msg('userAlreadyActivated'), email });
		}

		// Create new company.
		const companyId = (await db
			.insertInto('company')
			.values({ lat: null, lng: null, name: null, address: null, zone: null })
			.returning('company.id')
			.executeTakeFirst())!.id;

		// Set user as company owner.
		await db
			.updateTable('user')
			.set({ companyId: companyId, isTaxiOwner: true })
			.where('email', '=', email)
			.executeTakeFirst();

		return { msg: msg('activationSuccess', 'success') };
	}
};
