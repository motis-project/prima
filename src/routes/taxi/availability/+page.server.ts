import { db } from '$lib/server/db';
import { getTours } from '$lib/server/db/getTours.js';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import type { Actions, RequestEvent } from './$types';
import { fail } from '@sveltejs/kit';
import { msg } from '$lib/msg';
import { readInt } from '$lib/server/util/readForm';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';
import type { Range } from './Range';
import { split } from './Range';
import { groupBy } from '$lib/server/util/groupBy';
import { Interval } from '$lib/server/util/interval';

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

	const tours = getTours(false, companyId, [fromTime.getTime(), toTime.getTime()]);

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

	// HEATMAP
	const heatmapInfos = await db
		.with('thiszone', (db) => db.selectFrom('company').where('id', '=', companyId).select(['zone']))
		.selectFrom('availability')
		.innerJoin('vehicle', 'vehicle.id', 'availability.vehicle')
		.innerJoin('company', 'company.id', 'vehicle.company')
		.innerJoin('thiszone', (join) => join.onTrue())
		.where('availability.startTime', '<', toTime.getTime())
		.where('availability.endTime', '>', fromTime.getTime())
		.where('vehicle.company', '!=', companyId)
		.whereRef('thiszone.zone', '=', 'company.zone')
		.select([
			'availability.startTime',
			'availability.endTime',
			'availability.vehicle',
			'vehicle.company'
		])
		.execute();

	const mergedheatinfos = groupBy(
		heatmapInfos,
		(a) => a.vehicle,
		(a) => new Interval(a.startTime, a.endTime)
	);
	mergedheatinfos.forEach((heatmap, vehicle) =>
		mergedheatinfos.set(vehicle, Interval.merge(heatmap))
	);

	type heatinfo = {
		cell: Range;
		heat: number;
	};
	const heatarray: heatinfo[] = [];
	const isAInsideB = (rangeA: Range, Bstart: UnixtimeMs, Bend: UnixtimeMs) => {
		return (
			rangeA.startTime >= Bstart &&
			rangeA.startTime < Bend &&
			rangeA.endTime >= Bstart &&
			rangeA.endTime <= Bend
		);
	};
	const range: Range = { startTime: fromTime.getTime(), endTime: toTime.getTime() };
	const hours = split(range, 60);
	let heatcount = 0;
	for (const hour of hours) {
		const cell = split(hour, 15);
		for (const onecell of cell) {
			mergedheatinfos.forEach((heatIntervals) => {
				for (const interval of heatIntervals) {
					if (isAInsideB(onecell, interval.startTime, interval.endTime)) {
						heatcount++;
					}
				}
			});
			heatarray.push({ cell: onecell, heat: heatcount });
			heatcount = 0;
		}
	}

	return {
		tours: await tours,
		vehicles: await vehicles,
		heatarray,
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
