import { db } from '$lib/server/db';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { getToursWithRequests } from '$lib/server/db/getTours.js';

export async function getAvailability(utcDate: Date, companyId: number) {
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
					.select([
						'availability.id',
						'availability.startTime',
						'availability.endTime',
						'availability.createdAt'
					])
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

export async function getAllCompaniesAvailability(utcDate: Date) {
	const fromTime = new Date(utcDate);
	fromTime.setHours(utcDate.getHours() - 1);
	const toTime = new Date(utcDate);
	toTime.setHours(utcDate.getHours() + 25);

	const vehicles = db
		.selectFrom('company')
		.select('company.name as licensePlate')
		.select('company.id as id')
		.select((eb) => [
			jsonArrayFrom(
				eb
					.selectFrom('vehicle')
					.innerJoin('availability', 'vehicle.id', 'availability.vehicle')
					.whereRef('vehicle.company', '=', 'company.id')
					.where('availability.startTime', '<', toTime.getTime())
					.where('availability.endTime', '>', fromTime.getTime())
					.select([
						'availability.id',
						'availability.startTime',
						'availability.endTime',
						'availability.createdAt'
					])
					.orderBy('availability.startTime')
			).as('availability')
		])
		.execute();

	return {
		tours: [],
		vehicles: await vehicles,
		utcDate,
		companyDataComplete: true,
		companyCoordinates: null
	};
}
