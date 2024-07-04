import type { PageServerLoad, Actions } from './$types.js';
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { formSchema } from './schema.js';
import { db } from '$lib/database';
import { geoCode } from '$lib/api.js';
import type { Company } from '$lib/types.js';

const company_id: number | undefined = undefined;
export const load: PageServerLoad = async () => {
	const zones = await db.selectFrom('zone').where('is_community', '=', false).selectAll().execute();
	const communities = await db
		.selectFrom('zone')
		.where('is_community', '=', true)
		.selectAll()
		.execute();
	let company: Company | undefined = undefined;
	if (company_id) {
		company = await db
			.selectFrom('company')
			.where('id', '=', company_id)
			.selectAll()
			.executeTakeFirst();
	}
	const form = await superValidate(zod(formSchema));
	if (company) {
		form.data.companyname = company.display_name;
		form.data.email = company.email;
		form.data.address = company.address;
		form.data.community = communities.find((c) => (c.id! = company!.community_area))!.name;
		form.data.zone = zones.find((z) => (z.id! = company!.zone))!.name;
	}
	return {
		form,
		zones: zones,
		communities: communities,
		company: company_id ? company : undefined
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event, zod(formSchema));
		if (!form.valid) {
			return fail(400, {
				form
			});
		}
		const name = form.data.companyname;
		const zone = form.data.zone;
		const community = form.data.community;
		const email = form.data.email;
		const address = form.data.address;
		const addressJson = await geoCode(address);
		if (addressJson.length == 0) {
			return fail(400, {
				form
			});
		}
		const best_address_guess = addressJson[0];
		const latitude = best_address_guess.pos.lat;
		const longitude = best_address_guess.pos.lng;
		const zone_id = await db
			.selectFrom('zone')
			.where('name', '=', zone)
			.select('id')
			.executeTakeFirst();
		const community_id = await db
			.selectFrom('zone')
			.where('name', '=', community)
			.select('id')
			.executeTakeFirst();
		if (!company_id) {
			db.insertInto('company')
				.values({
					display_name: name,
					email,
					zone: zone_id!.id,
					community_area: community_id!.id,
					address,
					latitude,
					longitude
				})
				.execute();
		} else {
			db.updateTable('company')
				.set({
					display_name: name,
					email,
					zone: zone_id!.id,
					community_area: community_id!.id,
					address,
					latitude,
					longitude
				})
				.where('id', '=', company_id)
				.execute();
		}
	}
};
