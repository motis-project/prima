import { db } from '$lib/server/db';
import { getTours } from '$lib/server/db/getTours.js';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import type { Actions, RequestEvent } from './$types';
import { fail } from '@sveltejs/kit';
import { msg } from '$lib/msg';

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
					.where('availability.startTime', '<', toTime)
					.where('availability.endTime', '>', fromTime)
					.select(['availability.id', 'availability.startTime', 'availability.endTime'])
					.orderBy('availability.startTime')
			).as('availability')
		])
		.execute();

	const tours = getTours(companyId, [fromTime, toTime]);

	const company = await db
		.selectFrom('company')
		.where('id', '=', companyId)
		.selectAll()
		.executeTakeFirstOrThrow();

	const companyDataComplete =
		company.name !== null &&
		company.address !== null &&
		company.zone !== null &&
		company.latitude !== null &&
		company.longitude !== null;

	return {
		tours: await tours,
		vehicles: await vehicles,
		utcDate,
		companyDataComplete
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
		const nPassengers = formData.get('nPassengers');
		const bikeCapacity = formData.get('bike');
		const wheelchairCapacity = formData.get('wheelchair');
		const storageSpace = formData.get('storageSpace');
		const seats = formData.get('seats');

		if (
			typeof licensePlate !== 'string' ||
			typeof nPassengers !== 'string' ||
			typeof bikeCapacity !== 'string' ||
			typeof wheelchairCapacity !== 'string' ||
			typeof storageSpace !== 'string'
		) {
			throw 'invalid parameters';
		}

		try {
			await db
				.insertInto('vehicle')
				.values({
					licensePlate,
					company,
					seats: Number(seats),
					wheelchairCapacity: wheelchairCapacity == 'on' ? 1 : 0,
					bikeCapacity: bikeCapacity == 'on' ? 1 : 0,
					storageSpace: Number(storageSpace)
				})
				.execute();
		} catch (e) {
			// @ts-expect-error: 'e' is of type 'unknown'
			if (e.constraint == 'vehicle_license_plate_key') {
				return fail(400, { msg: msg('enterEmailAndPassword') });
			}
			return fail(400, { msg: msg('enterEmailAndPassword') });
		}

		return { msg: msg('activationSuccess') };
	}
};
