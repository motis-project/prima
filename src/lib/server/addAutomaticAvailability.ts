import { AUTOMATIC_AVAILABILITY_END, AUTOMATIC_AVAILABILITY_START } from '$lib/constants';
import { db } from '$lib/server/db';
import { getAllowedTimes } from '$lib/util/getAllowedTimes';
import { Interval } from '$lib/util/interval';

export async function addAutomaticAvailability(interval: Interval): Promise<number> {
	const allowedTimes = getAllowedTimes(
		interval.startTime,
		interval.endTime,
		AUTOMATIC_AVAILABILITY_START,
		AUTOMATIC_AVAILABILITY_END
	)
		.map((allowed) => allowed.intersect(interval))
		.filter((allowed) => allowed !== undefined);

	return db.transaction().execute(async (trx) => {
		let inserted = 0;
		for (const allowed of allowedTimes) {
			const result = await trx
				.insertInto('availability')
				.columns(['vehicle', 'startTime', 'endTime'])
				.expression((eb) => {
					const selectedVehicles = eb
						.selectFrom('vehicle')
						.where('vehicle.setAutomaticAvailability', '=', true)
						.select(['vehicle.id']);

					return eb
						.selectFrom(selectedVehicles.as('selectedVehicle'))
						.where(({ exists, not, selectFrom }) =>
							not(
								exists(
									selectFrom('availability')
										.select('availability.id')
										.whereRef('availability.vehicle', '=', 'selectedVehicle.id')
										.where('availability.startTime', '=', allowed.startTime)
										.where('availability.endTime', '=', allowed.endTime)
								)
							)
						)
						.select([
							'selectedVehicle.id as vehicle',
							eb.val(allowed.startTime).as('startTime'),
							eb.val(allowed.endTime).as('endTime')
						]);
				})
				.executeTakeFirst();
			inserted += Number(result.numInsertedOrUpdatedRows ?? 0);
		}
		return inserted;
	});
}
