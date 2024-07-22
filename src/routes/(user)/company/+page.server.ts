import type { PageServerLoad, Actions } from './$types.js';
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { formSchema } from './schema.js';
import { db } from '$lib/database';
import { geoCode } from '$lib/api.js';

export const load: PageServerLoad = async (event) => {
	const companyId = event.locals.user?.company;
	const zones = await db.selectFrom('zone').where('is_community', '=', false).selectAll().execute();
	const communities = await db
		.selectFrom('zone')
		.where('is_community', '=', true)
		.selectAll()
		.execute();
	const form = await superValidate(zod(formSchema));
	if (companyId) {
		const company = await db
			.selectFrom('company')
			.where('id', '=', companyId)
			.selectAll()
			.executeTakeFirst();
		if (company!.name != null) {
			form.data.companyname = company!.name;
			form.data.address = company!.address!;
			form.data.zone = zones.find((z) => z.id! === company!.zone!)!.name;
			form.data.community = communities.find((z) => z.id! === company!.community_area!)!.name;
		}
	}
	return {
		form,
		zones,
		communities
	};
};

export const actions: Actions = {
	default: async (event) => {
		const companyId = event.locals.user!.company!;
		const form = await superValidate(event, zod(formSchema));
		if (!form.valid) {
			return fail(400, {
				form
			});
		}
		const address = form.data.address;
		try {
			const best_address_guess = await geoCode(address);
			db.updateTable('company')
				.set({
					name: form.data.companyname,
					zone: (await db
						.selectFrom('zone')
						.where('name', '=', form.data.zone)
						.select('id')
						.executeTakeFirst())!.id,
					community_area: (await db
						.selectFrom('zone')
						.where('name', '=', form.data.community)
						.select('id')
						.executeTakeFirst())!.id,
					address,
					latitude: best_address_guess.pos.lat,
					longitude: best_address_guess.pos.lng
				})
				.where('id', '=', companyId)
				.execute();
		} catch {
			form.errors.address = ['Die Addresse konnte nicht zugeordent werden.'];
			return fail(400, {
				form
			});
		}
	}
};
