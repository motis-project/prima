import type { PageServerLoad, Actions } from './$types.js';
import { fail } from '@sveltejs/kit';
import { db } from '$lib/database';
import { AddressGuess, geoCode, type BookingRequestParameters } from '$lib/api.js';
import { sql } from 'kysely';
import { Coordinates, Location } from '$lib/location.js';

export const load: PageServerLoad = async (event) => {
	const r = {
		userChosen: new Coordinates(51.03485947001579, 13.293447066879821),
		busStops: [new Coordinates(1,1)],
		startFixed: true,
		timeStamps: [[new Date(Date.now()).toISOString()]],
		numPassengers: 1,
		numWheelchairs: 0,
		numBikes: 0,
		luggage: 0
	};
	const a= JSON.stringify(r);
	const res = await event.fetch('/api/blacklisting', {
		method: 'POST',
		body: a
	});

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
			console.log(data, community_area);
			return fail(400, { error: 'Gemeinde nicht gesetzt.' });
		}

		if (isNaN(zone) || zone < 1) {
			return fail(400, { error: 'Pflichtfahrgebiet nicht gesetzt.' });
		}

		let bestAddressGuess: AddressGuess | undefined = undefined;
		try {
			bestAddressGuess = await geoCode(address);
		} catch {
			return fail(400, { error: 'Die Addresse konnte nicht gefunden werden.' });
		}

		if (
			!(await db
				.selectFrom('zone')
				.where((eb) =>
					eb.and([
						eb('zone.id', '=', community_area),
						sql<boolean>`ST_Covers(zone.area, ST_SetSRID(ST_MakePoint(${bestAddressGuess!.pos.lng}, ${bestAddressGuess!.pos.lat}),4326))`
					])
				)
				.executeTakeFirst())
		) {
			return fail(400, {
				error: 'Die Addresse liegt nicht in der ausgewählten Gemeinde.'
			});
		}

		if (
			!(await db
				.selectFrom('zone as compulsory_area')
				.where('compulsory_area.id', '=', zone)
				.innerJoin(
					(eb) =>
						eb.selectFrom('zone').where('id', '=', community_area).selectAll().as('community'),
					(join) => join.onTrue()
				)
				.where(sql<boolean>`ST_Intersects(compulsory_area.area, community.area)`)
				.selectAll()
				.executeTakeFirst())
		) {
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
				latitude: bestAddressGuess!.pos.lat,
				longitude: bestAddressGuess!.pos.lng
			})
			.where('id', '=', companyId)
			.execute();

		return { success: true };
	}
} satisfies Actions;
