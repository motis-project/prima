import { json } from '@sveltejs/kit';
import { db } from '$lib/database';
import { sql } from 'kysely';
import type { NewAvailability, Availability } from '$lib/types.js';
import { Interval } from '$lib/interval.js';

const to_availability = (interval: Interval, id: number, vehicle: number): Availability => {
	return {
		start_time: interval.start_time,
		end_time: interval.end_time,
		vehicle: vehicle,
		id: id
	};
};

const to_new_availability = (interval: Interval, vehicle: number): NewAvailability => {
	return {
		start_time: interval.start_time,
		end_time: interval.end_time,
		vehicle: vehicle
	};
};

export const DELETE = async ({ request }) => {
	const { vehicle_id, from, to } = await request.json();
	const start = new Date(from);
	const end = new Date(to);
	const to_remove = new Interval(start, end);
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
		const to_remove_ids = Array<number>();
		const cut = Array<Availability>();
		const create = Array<NewAvailability>();
		overlapping.forEach((a) => {
			const availability = new Interval(a.start_time, a.end_time);
			if (to_remove.contains(availability)) {
				to_remove_ids.push(a.id);
			} else if (availability.contains(to_remove) && !availability.equals(to_remove)) {
				to_remove_ids.push(a.id);
				const [left, right] = availability.split(to_remove);
				create.push(to_new_availability(left, a.vehicle));
				create.push(to_new_availability(right, a.vehicle));
			} else {
				cut.push(to_availability(availability.cut(to_remove), a.id, a.vehicle));
			}
		});
		const promises = [];
		if (to_remove_ids.length > 0) {
			promises.push(trx.deleteFrom('availability').where('id', 'in', to_remove_ids).execute());
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
	await db
		.insertInto('availability')
		.values({
			start_time: new Date(from),
			end_time: new Date(to),
			vehicle: vehicle_id
		})
		.execute();
	return json({});
};
