import type { PageServerLoad, Actions } from './$types.js';
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { formSchema } from './schema.js';
import { db } from '$lib/database';
import { AddressGuess, geoCode } from '$lib/api.js';
import { sql } from 'kysely';

export const load: PageServerLoad = async (event) => {
	const companyId = event.locals.user?.company;
	const zones = await db
		.selectFrom('zone')
		.where('is_community', '=', false)
		.select(['id', 'name'])
		.orderBy('name')
		.execute();
	const communities = await db
		.selectFrom('zone')
		.where('is_community', '=', true)
		.select(['id', 'name'])
		.orderBy('name')
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
		let bestAddressGuess: AddressGuess | undefined = undefined;
		try {
			bestAddressGuess = await geoCode(address);
		} catch {
			form.errors.address = ['Die Addresse konnte nicht zugeordent werden.'];
			return fail(400, {
				form
			});
		}
		try {
			await db
				.selectFrom('zone')
				.where((eb) =>
					eb.and([
						eb('zone.is_community', '=', true),
						eb('zone.name', '=', form.data.community),
						sql<boolean>`ST_Covers(zone.area, ST_SetSRID(ST_MakePoint(${bestAddressGuess!.pos.lng}, ${bestAddressGuess!.pos.lat}),4326))`
					])
				)
				.executeTakeFirstOrThrow();
		} catch {
			form.errors.address = ['Die Addresse liegt nicht in der ausgewählten Gemeinde.'];
			form.errors.community = ['Die Addresse liegt nicht in der ausgewählten Gemeinde.'];
			return fail(400, {
				form
			});
		}
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
				latitude: bestAddressGuess!.pos.lat,
				longitude: bestAddressGuess!.pos.lng
			})
			.where('id', '=', companyId)
			.execute();
	}
};
