import { db, type Database } from '$lib/server/db';
import { Interval } from '$lib/util/interval';
import { json } from '@sveltejs/kit';
import { type Insertable, type Selectable } from 'kysely';
import { getAlterableTimeframe } from '$lib/util/getAlterableTimeframe';
import { addAvailability } from '$lib/server/addAvailability';
import { retry } from '$lib/server/db/retryQuery';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { getToursWithRequests } from '$lib/server/db/getTours.js';

type Availability = Selectable<Database['availability']>;
type NewAvailability = Insertable<Database['availability']>;

const toAvailability = (interval: Interval, id: number, vehicle: number): Availability => {
	return {
		startTime: interval.startTime,
		endTime: interval.endTime,
		vehicle: vehicle,
		id: id
	};
};

const toNewAvailability = (interval: Interval, vehicle: number): NewAvailability => {
	return {
		startTime: interval.startTime,
		endTime: interval.endTime,
		vehicle: vehicle
	};
};

export const DELETE = async ({ locals, request }) => {
	const companyId = locals.session?.companyId;
	if (!companyId) {
		throw 'not allowed';
	}

	const { vehicleId, from, to } = await request.json();
	if (typeof vehicleId !== 'number' || typeof from !== 'number' || typeof to !== 'number') {
		console.log('remove availability invalid params: ', { vehicleId, from, to });
		throw 'invalid params';
	}

	const toRemove = new Interval(from, to).intersect(getAlterableTimeframe());
	if (toRemove === undefined) {
		return json({});
	}
	console.log('remove availability vehicle=', vehicleId, 'toRemove=', toRemove);
	await retry(() =>
		db
			.transaction()
			.setIsolationLevel('serializable')
			.execute(async (trx) => {
				const overlapping = await trx
					.selectFrom('availability')
					.where(({ eb }) =>
						eb.and([
							eb('availability.vehicle', '=', vehicleId),
							eb('availability.startTime', '<', to),
							eb('availability.endTime', '>', from),
							eb.exists(
								eb
									.selectFrom('vehicle')
									.where('vehicle.id', '=', vehicleId)
									.where('vehicle.company', '=', companyId)
							)
						])
					)
					.selectAll()
					.execute();
				const toRemoveIds = Array<number>();
				const cut: Array<Availability> = [];
				const create: Array<NewAvailability> = [];
				overlapping.forEach((a) => {
					const availability = new Interval(a.startTime, a.endTime);
					if (toRemove.contains(availability)) {
						toRemoveIds.push(a.id);
					} else if (availability.contains(toRemove) && !availability.eitherEndIsEqual(toRemove)) {
						toRemoveIds.push(a.id);
						const [left, right] = availability.split(toRemove);
						create.push(toNewAvailability(left, a.vehicle));
						create.push(toNewAvailability(right, a.vehicle));
					} else {
						cut.push(toAvailability(availability.cut(toRemove), a.id, a.vehicle));
					}
				});
				const promises = [];
				if (toRemoveIds.length > 0) {
					promises.push(trx.deleteFrom('availability').where('id', 'in', toRemoveIds).execute());
				}
				if (create.length > 0) {
					promises.push(trx.insertInto('availability').values(create).execute());
				}
				if (cut.length > 0) {
					promises.push(
						trx
							.insertInto('availability')
							.values(cut)
							.onConflict((oc) =>
								oc.column('id').doUpdateSet((eb) => ({
									startTime: eb.ref('excluded.startTime'),
									endTime: eb.ref('excluded.endTime'),
									vehicle: vehicleId
								}))
							)
							.execute()
					);
				}
				await Promise.all(promises);
			})
	);
	return json({});
};

export const POST = async ({ locals, request }) => {
	const companyId = locals.session?.companyId;
	if (!companyId) {
		throw 'no company';
	}
	const { vehicleId, from, to } = await request.json();
	if (typeof vehicleId !== 'number' || typeof from !== 'number' || typeof to !== 'number') {
		console.log('add availability invalid params: ', { vehicleId, from, to });
		throw 'invalid params';
	}

	const interval = new Interval(from, to).intersect(getAlterableTimeframe());
	if (interval === undefined) {
		return json({});
	}
	await addAvailability(interval, companyId, vehicleId);
	return json({});
};

export const GET = async ({ locals, url }) => {
	const companyId = locals.session?.companyId;
	if (!companyId) {
		throw 'company not defined';
	}

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

	return json({
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
	});
};
