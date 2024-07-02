import { json } from '@sveltejs/kit';
import { db } from '$lib/database';
import { sql } from 'kysely';
import type { NewAvailability, Availability } from '$lib/types.js';
import { Interval } from '$lib/interval.js';

export const DELETE = async ({ request }) => {
	const { vehicle_id, from, to } = await request.json();
	const start = new Date(from);
	const end = new Date(to);
	const availability_to_remove = new Interval(start, end);
	await db.transaction().execute(async (trx) => {
		sql`LOCK TABLE availability IN ACCESS EXCLUSIVE MODE;`.execute(trx);
		const overlapping = await trx
			.selectFrom('availability')
			.where(({ eb }) =>
				eb.and([
					eb('vehicle', '=', vehicle_id),
					eb('availability.start_time', '<', end),
					eb('availability.end_time', '>', start)
				])
			)
			.selectAll()
			.execute();
		const remove = Array<number>();
		const cut = Array<Availability>();
		const create = Array<NewAvailability>();
		overlapping.forEach((a) => {
			const existing_availability = new Interval(a.start_time, a.end_time);
			if (availability_to_remove.contains(existing_availability)) {
				remove.push(a.id);
			} else if (
				existing_availability.contains(availability_to_remove) &&
				existing_availability.start_time.getTime() != availability_to_remove.start_time.getTime() &&
				existing_availability.end_time.getTime() != availability_to_remove.end_time.getTime()
			) {
				remove.push(a.id);
				const split_result = existing_availability.split(availability_to_remove);
				create.push(split_result[0].to_new_availability(a.vehicle));
				create.push(split_result[1].to_new_availability(a.vehicle));
			} else {
				cut.push(
					existing_availability.cut(availability_to_remove).to_availability(a.id, a.vehicle)
				);
			}
		});
		const promises = [];
		if (remove.length > 0) {
			promises.push(trx.deleteFrom('availability').where('id', 'in', remove).execute());
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
							end_time: eb.ref('excluded.end_time')
						}))
					)
					.execute()
			);
		}
		await Promise.all(promises);
	});
	return json({});
};

export const POST = async ({ request }) => {
	const { vehicle_id, from, to } = await request.json();
	const start = new Date(from);
	const end = new Date(to);
	let availability_to_add = new Interval(start, end);
	await db.transaction().execute(async (trx) => {
		sql`LOCK TABLE availability IN ACCESS EXCLUSIVE MODE;`.execute(trx);
		const overlapping = await trx
			.selectFrom('availability')
			.where(({ eb }) =>
				eb.and([
					eb('vehicle', '=', vehicle_id),
					eb('availability.start_time', '<=', end),
					eb('availability.end_time', '>=', start)
				])
			)
			.selectAll()
			.execute();
		const remove = Array<number>();
		let contained = false;
		overlapping.forEach((a) => {
			const existing_availability = new Interval(a.start_time, a.end_time);
			if (availability_to_add.contains(existing_availability)) {
				remove.push(a.id);
			} else if (existing_availability.contains(availability_to_add)) {
				contained = true;
			} else {
				remove.push(a.id);
				availability_to_add = availability_to_add.merge(existing_availability);
			}
		});
		const promises = [];
		if (!contained) {
			promises.push(
				trx
					.insertInto('availability')
					.values({
						start_time: availability_to_add.start_time,
						end_time: availability_to_add.end_time,
						vehicle: vehicle_id
					})
					.execute()
			);
		}
		if (remove.length > 0) {
			promises.push(trx.deleteFrom('availability').where('id', 'in', remove).execute());
		}
		await Promise.all(promises);
	});
	return json({});
};
