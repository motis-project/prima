import { db } from '../src/lib/server/db/index.js';
import { groupBy } from '../src/lib/util/groupBy';
import { Interval } from '../src/lib/util/interval.js';
import { DAY } from '../src/lib/util/time.js';

export async function main() {
	const cutoff = Date.now() - 28 * DAY;
	const availabilies = await db
		.selectFrom('vehicle')
		.innerJoin('availability', 'availability.vehicle', 'vehicle.id')
		.selectAll('availability')
		.select('vehicle.company')
		.where('availability.endTime', '>', cutoff)
		.execute();

	const vehicles = groupBy(
		availabilies,
		(a) => a.vehicle,
		(a) => a
	);
	const vehicleScoresByCompany = new Map<number, { vehicle: number; score: number }>();
	for (const [_, v] of vehicles) {
		const company = v[0].company;
		const score = Interval.merge(
			v.map((a) => new Interval(Math.max(a.startTime, cutoff), a.endTime))
		).reduce((prev, curr) => (prev += curr.size()), 0);
		if (
			!vehicleScoresByCompany.has(company) ||
			vehicleScoresByCompany.get(company)!.score < score
		) {
			vehicleScoresByCompany.set(company, {
				vehicle: v[0].vehicle,
				score
			});
		}
	}

	for (const [c, v] of vehicleScoresByCompany) {
		await db
			.updateTable('vehicle')
			.set({ setAutomaticAvailability: true })
			.where('vehicle.id', '=', v.vehicle)
			.where((eb) =>
				eb.not((eb) =>
					eb.exists((eb) =>
						eb
							.selectFrom('vehicle')
							.where('vehicle.company', '=', c)
							.where('vehicle.setAutomaticAvailability', '=', true)
					)
				)
			)
			.execute();
	}
}

main().catch((error) => {
	console.error('Error in main function:', error);
});