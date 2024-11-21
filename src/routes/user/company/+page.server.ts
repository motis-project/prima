import type { PageServerLoad, Actions } from './$types.js';
import { fail } from '@sveltejs/kit';
import { db } from '$lib/database';
import { Coordinates } from '$lib/location.js';
import { covers, intersects } from '$lib/sqlHelpers.js';
import { geocode } from '$lib/motis/services.gen.js';
import { MOTIS_BASE_URL } from '$lib/constants.js';
import type { GeocodeResponse } from '$lib/motis/types.gen.js';

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
	const company = companyId
		? await db.selectFrom('company').where('id', '=', companyId).selectAll().executeTakeFirst()
		: {
				zone: null,
				address: null,
				latitude: null,
				longitude: null,
				name: null,
				community_area: null
			};
	return {
		company,
		zones,
		communities
	};
};

export const actions = {
	default: async (event) => {
		const readInt = (x: FormDataEntryValue | null) => {
			return x === null ? NaN : parseInt(x.toString());
		};

		const companyId = event.locals.user!.company!;
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

		let bestAddressGuess: Coordinates|undefined=undefined;
		try{
		const response: GeocodeResponse = await geocode({
			baseUrl: MOTIS_BASE_URL,
			query: {
				text: address
			}
		}).then((res) => {
			return res.data!;
		});
		if (response.length == 0) {
			return fail(400, { error: 'Die Addresse konnte nicht gefunden werden.' });
		}
		bestAddressGuess = new Coordinates(response[0].lat, response[0].lon);
		}catch{
			console.log("Fehler beim Ansprechen des geocode Endpunkt von Motis");
			return fail(400, { error: 'Die Addresse konnte nicht gefunden werden.' });
		}

		if (!(await contains(community_area, bestAddressGuess))) {
			return fail(400, {
				error: 'Die Addresse liegt nicht in der ausgewählten Gemeinde.'
			});
		}

		if (!(await intersects(zone, community_area))) {
			return fail(400, {
				error: 'Die Gemeinde liegt nicht im Pflichtfahrgebiet.'
			});
		}

		await db
			.updateTable('company')
			.set({
				name,
				zone,
				community_area,
				address,
				latitude: bestAddressGuess!.lat,
				longitude: bestAddressGuess!.lng
			})
			.where('id', '=', companyId)
			.execute();

		return { success: true };
	}
} satisfies Actions;

const contains = async (community: number, coordinates: Coordinates): Promise<boolean> => {
	return (
		(await db
			.selectFrom('zone')
			.where((eb) => eb.and([eb('zone.id', '=', community), covers(eb, coordinates!)]))
			.executeTakeFirst()) != undefined
	);
};
