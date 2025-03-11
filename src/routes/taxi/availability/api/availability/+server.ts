import { EARLIEST_SHIFT_START, LATEST_SHIFT_END, MIN_PREP } from '$lib/constants';
import { getAllowedTimes } from '$lib/server/booking/evaluateRequest';
import { db, type Database } from '$lib/server/db';
import { Interval } from '$lib/server/util/interval';
import { nowOrSimulationTime } from '$lib/util/time.js';
import { HOUR, MINUTE } from '$lib/util/time';
import { json } from '@sveltejs/kit';
import { sql, type Insertable, type Selectable } from 'kysely';

function getFirstAlterableTime() {
	return Math.ceil((nowOrSimulationTime().getTime() + MIN_PREP) / (15 * MINUTE)) * 15 * MINUTE;
}
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

	const restrictedFrom = Math.max(getFirstAlterableTime(), from);
	if (to <= restrictedFrom) {
		return json({});
	}
	const toRemove = new Interval(restrictedFrom, to);
	console.log('remove availability vehicle=', vehicleId, 'toRemove=', toRemove);
	await db.transaction().execute(async (trx) => {
		await sql`LOCK TABLE availability IN ACCESS EXCLUSIVE MODE;`.execute(trx);
		const overlapping = await trx
			.selectFrom('availability')
			.where(({ eb }) =>
				eb.and([
					eb('vehicle', '=', vehicleId),
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
	});
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

	const restrictedFrom = Math.max(from, getFirstAlterableTime());
	if (to <= restrictedFrom) {
		return json({});
	}
	const interval = new Interval(restrictedFrom, to);
	await Promise.all(
		getAllowedTimes(restrictedFrom, to, EARLIEST_SHIFT_START - HOUR, LATEST_SHIFT_END + HOUR)
			.map((allowed) => allowed.intersect(interval))
			.filter((a) => a != undefined)
			.map((availability) =>
				db
					.insertInto('availability')
					.columns(['startTime', 'endTime', 'vehicle'])
					.expression((eb) =>
						eb
							.selectFrom('vehicle')
							.select((eb) => [
								eb.val(availability.startTime).as('startTime'),
								eb.val(availability.endTime).as('endTime'),
								'vehicle.id as vehicle'
							])
							.where('vehicle.company', '=', companyId)
							.where('vehicle.id', '=', vehicleId)
					)
					.execute()
			)
	);
	return json({});
};
