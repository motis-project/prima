import { db } from '$lib/server/db';
import { getAllowedTimes } from '$lib/util/getAllowedTimes';
import { Interval } from '$lib/util/interval';

export async function addAutomaticAvailability(interval: Interval): Promise<number> {
	return db.transaction().execute(async (trx) => {
		const configurations = await trx
			.selectFrom('vehicle')
			.innerJoin('company', 'company.id', 'vehicle.company')
			.where('vehicle.setAutomaticAvailability', '=', true)
			.select(['company.automaticAvailabilityStart', 'company.automaticAvailabilityEnd'])
			.distinct()
			.execute();

		let inserted = 0;
		for (const configuration of configurations) {
			const allowedTimes = getAllowedTimes(
				interval.startTime,
				interval.endTime,
				configuration.automaticAvailabilityStart,
				configuration.automaticAvailabilityEnd
			)
				.map((allowed) => allowed.intersect(interval))
				.filter((allowed) => allowed !== undefined);

			for (const allowed of allowedTimes) {
				const result = await trx
					.insertInto('availability')
					.columns(['vehicle', 'startTime', 'endTime'])
					.expression((eb) => {
						const selectedVehicles = eb
							.selectFrom('vehicle')
							.innerJoin('company', 'company.id', 'vehicle.company')
							.where('vehicle.setAutomaticAvailability', '=', true)
							.where(
								'company.automaticAvailabilityStart',
								'=',
								configuration.automaticAvailabilityStart
							)
							.where(
								'company.automaticAvailabilityEnd',
								'=',
								configuration.automaticAvailabilityEnd
							)
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
		}
		return inserted;
	});
}
