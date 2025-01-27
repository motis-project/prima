import { db } from '$lib/server/db';
import { getTours } from '$lib/server/db/getTours.js';
import { fail } from '@sveltejs/kit';

export async function load(event) {
	const companyId = event.locals.session?.companyId;
	if (!companyId) {
		return fail(401);
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
		.execute();

	const availabilitiesPromise = db
		.selectFrom('vehicle')
		.where('company', '=', companyId)
		.innerJoin('availability', 'vehicle', 'vehicle.id')
		.where('availability.startTime', '<', toTime)
		.where('availability.endTime', '>', fromTime)
		.select([
			'availability.id',
			'availability.startTime',
			'availability.endTime',
			'availability.vehicle'
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
		tours,
		vehicles: await vehicles,
		availabilities: await availabilitiesPromise,
		utcDate,
		companyDataComplete
	};
}
