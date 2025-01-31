import { error, json } from '@sveltejs/kit';
import { db } from '$lib/database';
import { sql } from 'kysely';
import type { NewAvailability, Availability } from '$lib/types.js';
import { Interval } from '$lib/interval.js';

const toAvailability = (
	interval: Interval,
	id: number,
	vehicle: number,
	cap: number
): Availability => {
	return {
		start_time: interval.startTime,
		end_time: interval.endTime,
		vehicle: vehicle,
		id: id,
		cap: cap
	};
};

const toNewAvailability = (interval: Interval, vehicle: number, cap: number): NewAvailability => {
	return {
		start_time: interval.startTime,
		end_time: interval.endTime,
		vehicle: vehicle,
		cap: cap
	};
};

export const DELETE = async (event) => {
	const companyId = event.locals.user?.company;
	if (!companyId) {
		error(400, {
			message: 'not allowed without write access to company'
		});
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
					eb('availability.start_time', '<', end),
					eb('availability.end_time', '>', start),
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
		const cut = Array<Availability>();
		const create = Array<NewAvailability>();
		overlapping.forEach((a) => {
			const availability = new Interval(a.start_time, a.end_time);
			if (toRemove.contains(availability)) {
				toRemoveIds.push(a.id);
			} else if (availability.contains(toRemove) && !availability.eitherEndIsEqual(toRemove)) {
				toRemoveIds.push(a.id);
				const [left, right] = availability.split(toRemove);
				create.push(toNewAvailability(left, a.vehicle, 0));
				create.push(toNewAvailability(right, a.vehicle, 0));
			} else {
				cut.push(toAvailability(availability.cut(toRemove), a.id, a.vehicle, 0));
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
							start_time: eb.ref('excluded.start_time'),
							end_time: eb.ref('excluded.end_time'),
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
	const companyId = event.locals.user?.company;
	if (!companyId) {
		error(400, {
			message: 'not allowed without write access to company'
		});
	}
	const request = event.request;
	const { vehicleId, from, to, cap } = await request.json();
	await db
		.insertInto('availability')
		.columns(['start_time', 'end_time', 'vehicle', 'cap'])
		.expression((eb) =>
			eb
				.selectFrom('vehicle')
				.select((eb) => [
					eb.val(new Date(from)).as('start_time'),
					eb.val(new Date(to)).as('end_time'),
					'vehicle.id as vehicle',
					eb.val(cap).as('cap')
				])
				.where(({ eb }) =>
					eb.and([eb('vehicle.company', '=', companyId), eb('vehicle.id', '=', vehicleId)])
				)
		)
		.execute();
	return json({});
};
