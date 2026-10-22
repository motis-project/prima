import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import type { PageServerLoad } from './$types.js';
import { covers } from '$lib/server/db/covers.js';
import { msg } from '$lib/msg.js';
import { readFloat, readInt } from '$lib/server/util/readForm.js';
import { verifyPhone } from '$lib/server/verifyPhone';
import {
	AUTOMATIC_AVAILABILITY_EARLIEST_END,
	AUTOMATIC_AVAILABILITY_EARLIEST_START,
	AUTOMATIC_AVAILABILITY_LATEST_END,
	AUTOMATIC_AVAILABILITY_LATEST_START
} from '$lib/constants';
import { isValidAutomaticAvailabilityTime } from '$lib/util/automaticAvailabilityTime';

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
		const phone = verifyPhone(data.get('phone'));
		const automaticAvailabilityStart = readInt(data.get('automaticAvailabilityStart'));
		const automaticAvailabilityEnd = readInt(data.get('automaticAvailabilityEnd'));

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
		if (phone != null && typeof phone !== 'string') {
			return phone;
		}
		if (
			!isValidAutomaticAvailabilityTime(
				automaticAvailabilityStart,
				AUTOMATIC_AVAILABILITY_EARLIEST_START,
				AUTOMATIC_AVAILABILITY_LATEST_START
			) ||
			!isValidAutomaticAvailabilityTime(
				automaticAvailabilityEnd,
				AUTOMATIC_AVAILABILITY_EARLIEST_END,
				AUTOMATIC_AVAILABILITY_LATEST_END
			)
		) {
			return fail(400, { msg: msg('automaticAvailabilityTimesInvalid') });
		}

		await db
			.updateTable('company')
			.set({
				name,
				zone,
				address,
				lat,
				lng,
				phone,
				automaticAvailabilityStart,
				automaticAvailabilityEnd
			})
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
