import { Interval } from '$lib/util/interval';
import { selectAvailabilities, selectTours } from '$lib/server/booking/taxi/getBookingAvailability';
import { AVAILABILITY_CONFIRMATION_DEADLINE } from '$lib/constants';
import { db } from '$lib/server/db';
import { groupBy } from '$lib/util/groupBy';
import { json, type RequestEvent } from '@sveltejs/kit';

export const POST = async (_: RequestEvent) => {
	const now = Date.now();
	const interval = new Interval(now, now + AVAILABILITY_CONFIRMATION_DEADLINE);
	const vehicles = await db
		.selectFrom('vehicle')
		.select((eb) => [
			'vehicle.company',
			'vehicle.id as vehicle',
			selectAvailabilities(eb, interval),
			selectTours(eb, interval)
		])
		.execute();
	const byCompany = groupBy(
		vehicles,
		(v) => v.company,
		(v) => v
	);
	for (const company of byCompany.values()) {
		if (company.length === 0) {
			continue;
		}
		const vehicleIntervals = company.flatMap((vehicle) =>
			Interval.merge(
				vehicle.tours
					.map((t) => new Interval(t.departure, t.arrival))
					.concat(vehicle.availabilities.map((a) => new Interval(a.startTime, a.endTime)))
			)
		);
		const withCounts = Interval.aggregate(vehicleIntervals);
		const score = withCounts.reduce(
			(prev, curr) => prev + (curr.count >= 1 ? curr.interval.size() : 0),
			0
		);
		await db
			.insertInto('availabilityState')
			.values({
				company: company[0].company,
				takenAt: now,
				score
			})
			.execute();
	}
	return json({});
};
