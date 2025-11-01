import { EARLIEST_SHIFT_START, LATEST_SHIFT_END } from '$lib/constants';
import { getAllowedTimes } from '$lib/util/getAllowedTimes';
import { getAlterableTimeframe } from '$lib/util/getAlterableTimeframe';
import { Interval } from '$lib/util/interval';
import { HOUR } from '$lib/util/time';
import { db } from './db';

export async function addAvailability(from: number, to: number, companyId: number, vehicleId: number): Promise<boolean> {
	const interval = new Interval(from, to).intersect(getAlterableTimeframe());
	if (interval === undefined) {
		return false;
	}
	console.log('add availability vehicle=', vehicleId, 'toRemove=', interval);
	await Promise.all(
		getAllowedTimes(
			interval.startTime,
			interval.endTime,
			EARLIEST_SHIFT_START - HOUR,
			LATEST_SHIFT_END + HOUR
		)
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
	return true;
}
