import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import type { PageServerLoad, Actions } from './$types.js';

export const load: PageServerLoad = async (event) => {
	const companyId = event.locals.session!.companyId!;
	const zones = await db.selectFrom('zone').select(['id', 'name']).orderBy('name').execute();
	const company = await db
		.selectFrom('company')
		.where('id', '=', companyId)
		.selectAll()
		.executeTakeFirstOrThrow();
	return { company, zones };
};

export const actions = {
	default: async (event) => {
		const readInt = (x: FormDataEntryValue | null) => {
			return x === null ? NaN : parseInt(x.toString());
		};

		const companyId = event.locals.session!.companyId!;
		const data = await event.request.formData();
		const address = data.get('address')?.toString();
		const name = data.get('name')?.toString();
		const community_area = readInt(data.get('community_area'));
		const zone = readInt(data.get('zone'));

		if (!name || name.length < 2) {
			return fail(400, { error: 'Name zu kurz.' });
		}

		if (!address || address.length < 2) {
			return fail(400, { error: 'Adresse zu kurz.' });
		}

		if (isNaN(community_area) || community_area < 1) {
			return fail(400, { error: 'Gemeinde nicht gesetzt.' });
		}

		if (isNaN(zone) || zone < 1) {
			return fail(400, { error: 'Pflichtfahrgebiet nicht gesetzt.' });
		}

		if (!(await contains(zone, bestAddressGuess))) {
			return fail(400, {
				error: 'Die Addresse liegt nicht in der ausgewählten Gemeinde.'
			});
		}

		await db
			.updateTable('company')
			.set({
				name,
				zone,
				address,
				latitude: bestAddressGuess!.lat,
				longitude: bestAddressGuess!.lng
			})
			.where('id', '=', companyId)
			.execute();

		return { success: true };
	}
};

const contains = async (community: number, coordinates: Coordinates): Promise<boolean> => {
	return (
		(await db
			.selectFrom('zone')
			.where((eb) => eb.and([eb('zone.id', '=', community), covers(eb, coordinates!)]))
			.executeTakeFirst()) != undefined
	);
};
