import { db } from '$lib/server/db';
import { Interval } from '$lib/util/interval';
import { json } from '@sveltejs/kit';
import { sql, type Insertable, type Selectable } from 'kysely';
import type Database from 'lucide-svelte/icons/database';

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

export const DELETE = async (event) => {
	const companyId = event.locals.session?.companyId;
	if (!companyId) {
		throw 'not allowed';
	}
	const request = event.request;
	const { vehicleId, from, to } = await request.json();
	const start = new Date(from);
	const end = new Date(to);
	const toRemove = new Interval(start, end);
	await db.transaction().execute(async (trx) => {
		sql`LOCK TABLE availability IN ACCESS EXCLUSIVE MODE;`.execute(trx);
		const overlapping = await trx
			.selectFrom('availability')
			.where(({ eb }) =>
				eb.and([
					eb('vehicle', '=', vehicleId),
					eb('availability.startTime', '<', end),
					eb('availability.endTime', '>', start),
					eb.exists(
						eb
							.selectFrom('vehicle')
							.where(({ eb }) =>
								eb.and([eb('vehicle.id', '=', vehicleId), eb('vehicle.company', '=', companyId)])
							)
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
	});
	return json({});
};

export const POST = async (event) => {
	const companyId = event.locals.session?.companyId;
	if (!companyId) {
		throw 'no company';
	}
	const request = event.request;
	const { vehicleId, from, to } = await request.json();
	console.log('add availability', { vehicleId, from, to });
	await db
		.insertInto('availability')
		.columns(['startTime', 'endTime', 'vehicle'])
		.expression((eb) =>
			eb
				.selectFrom('vehicle')
				.select((eb) => [
					eb.val(new Date(from)).as('startTime'),
					eb.val(new Date(to)).as('endTime'),
					'vehicle.id as vehicle'
				])
				.where(({ eb }) =>
					eb.and([eb('vehicle.company', '=', companyId), eb('vehicle.id', '=', vehicleId)])
				)
		)
		.execute();
	return json({});
};
