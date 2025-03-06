import { db } from '$lib/server/db';
import { getToursWithRequests } from '$lib/server/db/getTours.js';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import type { Actions, RequestEvent } from './$types';
import { fail } from '@sveltejs/kit';
import { msg } from '$lib/msg';
import { readInt } from '$lib/server/util/readForm';

export async function load(event) {
	const companyId = event.locals.session?.companyId;
	if (!companyId) {
		throw 'company not defined';
	}

	const url = event.url;
	const localDateParam = url.searchParams.get('date');
	const timezoneOffset = url.searchParams.get('offset');
	const utcDate =
		localDateParam && timezoneOffset
			? new Date(new Date(localDateParam!).getTime() + Number(timezoneOffset) * 60 * 1000)
			: new Date();
	const fromTime = new Date(utcDate);
	fromTime.setHours(utcDate.getHours() - 1);
	const toTime = new Date(utcDate);
	toTime.setHours(utcDate.getHours() + 25);

	const vehicles = db
		.selectFrom('vehicle')
		.where('company', '=', companyId)
		.selectAll()
		.select((eb) => [
			jsonArrayFrom(
				eb
					.selectFrom('availability')
					.whereRef('availability.vehicle', '=', 'vehicle.id')
					.where('availability.startTime', '<', toTime.getTime())
					.where('availability.endTime', '>', fromTime.getTime())
					.select(['availability.id', 'availability.startTime', 'availability.endTime'])
					.orderBy('availability.startTime')
			).as('availability')
		])
		.execute();

	const tours = getToursWithRequests(false, companyId, [fromTime.getTime(), toTime.getTime()]);

	const company = await db
		.selectFrom('company')
		.where('id', '=', companyId)
		.selectAll()
		.executeTakeFirstOrThrow();

	const companyDataComplete =
		company.name !== null &&
		company.address !== null &&
		company.zone !== null &&
		company.lat !== null &&
		company.lng !== null;

	return {
		tours: await tours,
		vehicles: await vehicles,
		utcDate,
		companyDataComplete,
		companyCoordinates: companyDataComplete
			? {
					lat: company.lat!,
					lng: company.lng!
				}
			: null
	};
}

export const actions: Actions = {
	addVehicle: async (event: RequestEvent) => {
		const company = event.locals.session?.companyId;
		if (!company) {
			throw 'company not defined';
		}

		const formData = await event.request.formData();
		const licensePlate = formData.get('licensePlate');
		const bike = formData.get('bike');
		const wheelchair = formData.get('wheelchair');
		const luggage = readInt(formData.get('luggage'));
		const passengers = readInt(formData.get('passengers'));

		if (passengers !== 3 && passengers !== 5 && passengers !== 7) {
			return fail(400, { msg: msg('invalidSeats') });
		}

		if (
			typeof licensePlate !== 'string' ||
			!/^([A-ZÄÖÜ]{1,3})-([A-ZÄÖÜ]{1,2})-([0-9]{1,4})$/.test(licensePlate)
		) {
			return fail(400, { msg: msg('invalidLicensePlate') });
		}

		if (isNaN(luggage) || luggage <= 0 || luggage >= 11) {
			return fail(400, { msg: msg('invalidStorage') });
		}

		try {
			await db
				.insertInto('vehicle')
				.values({
					licensePlate,
					company,
					passengers,
					luggage,
					wheelchairs: !wheelchair ? 0 : 1,
					bikes: !bike ? 0 : 1
				})
				.execute();
		} catch (e) {
			// @ts-expect-error: 'e' is of type 'unknown'
			if (e.constraint == 'vehicle_license_plate_key') {
				return fail(400, { msg: msg('duplicateLicensePlate') });
			}
			return fail(400, { msg: msg('unkownError') });
		}

		return { msg: msg('vehicleAddedSuccessfully', 'success') };
	}
};
