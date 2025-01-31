import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import type { PageServerLoad } from './$types.js';
import { covers } from '$lib/server/db/covers.js';
import { msg } from '$lib/msg.js';
import { readFloat, readInt } from '$lib/server/util/readForm.js';

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
		const companyId = event.locals.session!.companyId!;

		const data = await event.request.formData();
		const address = data.get('address')?.toString();
		const name = data.get('name')?.toString();
		const zone = readInt(data.get('zone'));
		const lat = readFloat(data.get('lat'));
		const lng = readFloat(data.get('lng'));

		if (typeof name !== 'string' || name.length < 2) {
			return fail(400, { msg: msg('nameTooShort') });
		}

		if (typeof address !== 'string' || address.length < 2) {
			return fail(400, { msg: msg('addressTooShort') });
		}

		if (isNaN(zone) || zone < 1) {
			return fail(400, { msg: msg('zoneNotSet') });
		}

		if (isNaN(lng) || isNaN(lat) || !(await contains(zone, { lng, lat }))) {
			return fail(400, { msg: msg('addressNotInZone') });
		}

		await db
			.updateTable('company')
			.set({ name, zone, address, lat, lng })
			.where('id', '=', companyId)
			.execute();

		return { msg: msg('companyUpdateSuccessful', 'success') };
	}
};

const contains = async (zoneId: number, c: maplibregl.LngLatLike): Promise<boolean> => {
	return (
		(await db
			.selectFrom('zone')
			.where((eb) => eb.and([eb('zone.id', '=', zoneId), covers(c)]))
			.executeTakeFirst()) != undefined
	);
};
