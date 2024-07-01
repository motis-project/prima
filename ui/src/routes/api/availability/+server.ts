import { json } from '@sveltejs/kit';
import { db } from '$lib/database';
import { sql } from 'kysely';
import type { NewAvailability, Availability } from '$lib/types.js';

export const DELETE = async ({ request }) => {
	const { vehicle_id, from, to } = await request.json();
	const start = new Date(from);
	const end = new Date(to);
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
			if (a.start_time >= start && a.end_time <= end) {
				remove.push(a.id);
			} else if (a.start_time >= start) {
				cut.push({ id: a.id, start_time: end, end_time: a.end_time, vehicle: vehicle_id });
			} else if (a.end_time <= end) {
				cut.push({ id: a.id, start_time: a.start_time, end_time: start, vehicle: vehicle_id });
			} else if (a.start_time < start && a.end_time > end) {
				remove.push(a.id);
				create.push({ start_time: a.start_time, end_time: start, vehicle: vehicle_id });
				create.push({ start_time: end, end_time: a.end_time, vehicle: vehicle_id });
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
	let start = new Date(from);
	let end = new Date(to);
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
			if (a.start_time >= start && a.end_time <= end) {
				remove.push(a.id);
			} else if (a.start_time <= start) {
				remove.push(a.id);
				start = a.start_time;
			} else if (a.end_time >= end) {
				remove.push(a.id);
				end = a.end_time;
			} else if (a.start_time < start && a.end_time > end) {
				contained = true;
			}
		});
		const promises = [];
		if (!contained) {
			promises.push(
				trx
					.insertInto('availability')
					.values({ start_time: start, end_time: end, vehicle: vehicle_id })
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
