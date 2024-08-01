import { db } from '$lib/database';
import { mapTourEvents } from './TourDetails';
import type { Vehicle } from './types';

export async function load(event) {
	const companyId = event.locals.user?.company;
	const url = event.url;
	const localDateParam = url.searchParams.get('date');
	const timezoneOffset = url.searchParams.get('offset');
	const utcDate =
		localDateParam && timezoneOffset
			? new Date(new Date(localDateParam!).getTime() + Number(timezoneOffset) * 60 * 1000)
			: new Date();
	if (!companyId) {
		return {
			tours: [],
			vehicles: [],
			availabilities: [],
			utcDate
		};
	}
	const earliest_displayed_time = new Date(utcDate);
	earliest_displayed_time.setHours(utcDate.getHours() - 1);
	const latest_displayed_time = new Date(utcDate);
	latest_displayed_time.setHours(utcDate.getHours() + 25);

	const vehicles = db.selectFrom('vehicle').where('company', '=', companyId).selectAll().execute();

	const availabilitiesPromise = db
		.selectFrom('vehicle')
		.where('company', '=', companyId)
		.innerJoin('availability', 'vehicle', 'vehicle.id')
		.where((eb) =>
			eb.and([
				eb('availability.start_time', '<', latest_displayed_time),
				eb('availability.end_time', '>', earliest_displayed_time)
			])
		)
		.select([
			'availability.id',
			'availability.start_time',
			'availability.end_time',
			'availability.vehicle'
		])
		.execute();

	const tours = mapTourEvents(
		await db
			.selectFrom('event')
			.innerJoin('address', 'address.id', 'event.address')
			.innerJoin('auth_user', 'auth_user.id', 'event.customer')
			.innerJoin('tour', 'tour.id', 'event.tour')
			.where((eb) =>
				eb.and([
					eb('tour.departure', '<', latest_displayed_time),
					eb('tour.arrival', '>', earliest_displayed_time)
				])
			)
			.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
			.where('company', '=', companyId)
			.orderBy('event.scheduled_time')
			.selectAll()
			.execute()
	);

	const company = await db
		.selectFrom('company')
		.where('id', '=', companyId)
		.selectAll()
		.executeTakeFirstOrThrow();
	const companyDataComplete =
		company.name !== null &&
		company.address !== null &&
		company.zone !== null &&
		company.community_area !== null &&
		company.latitude !== null &&
		company.longitude !== null;

	const availabilities = await availabilitiesPromise;

	return {
		tours,
		vehicles: new Map<number, Vehicle>(
			(await vehicles).map((v) => [
				v.id,
				{
					license_plate: v.license_plate,
					availability: availabilities
						.filter((a) => a.vehicle == v.id)
						.map((a) => ({ from: a.start_time, to: a.end_time }))
				}
			])
		),
		availabilities,
		utcDate,
		companyDataComplete
	};
}
