import { Interval } from '$lib/util/interval';
import { retry } from '$lib/server/db/retryQuery';
import { db, type Database } from '$lib/server/db';
import { type Insertable, type Selectable } from 'kysely';
import { getAlterableTimeframe } from '$lib/util/getAlterableTimeframe';

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

export async function deleteAvailability(
	from: number,
	to: number,
	vehicleId: number,
	companyId: number
): Promise<boolean> {
	const toRemove = new Interval(from, to).intersect(getAlterableTimeframe());
	if (toRemove === undefined) {
		return false;
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
	return true;
}
