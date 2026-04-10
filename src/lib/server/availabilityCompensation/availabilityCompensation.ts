import { Interval } from '$lib/util/interval';
import { selectAvailabilities, selectTours } from '$lib/server/booking/taxi/getBookingAvailability';
import {
	AVAILABILITY_CONFIRMATION_DEADLINE,
	EARLIEST_SHIFT_START,
	LATEST_SHIFT_END
} from '$lib/constants';
import { db } from '$lib/server/db';
import { groupBy } from '$lib/util/groupBy';

export async function computeCompensation(startOfMonth: number, selectedCompany?: number) {
	const availabilityStates = await db
		.selectFrom('availabilityState')
		.where('availabilityState.startOfMonth', '=', startOfMonth)
		.$if(selectedCompany !== undefined, (qb) =>
			qb.where('availabilityState.company', '=', selectedCompany!)
		)
		.select(['availabilityState.company', 'availabilityState.score', 'availabilityState.prefactor'])
		.execute();
	const byCompany = groupBy(
		availabilityStates,
		(a) => a.company,
		(a) => ({ score: a.score, prefactor: a.prefactor })
	);
	const ret = new Array<{ availabilityPercent: number; company: number }>();
	for (const [company, scores] of byCompany) {
		const avgScore =
			scores.length === 0
				? 0
				: scores.reduce((prev, curr) => prev + curr.prefactor * curr.score, 0) /
					scores.reduce((prev, curr) => prev + curr.prefactor, 0);
		ret.push({ availabilityPercent: avgScore, company });
		if (selectedCompany === undefined) {
			await db
				.insertInto('availabilityCompensation')
				.values({ score: avgScore, company, startOfMonth })
				.execute();
		}
	}
	return ret;
}

function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function getPrefactor(interval: Interval): number {
	const start = new Date(interval.startTime);
	const end = new Date(interval.endTime);
	let sum = 0;
	let day = startOfDay(start);
	while (day.getTime() < end.getTime()) {
		const midnight = day.getTime();
		const windowStart = midnight + EARLIEST_SHIFT_START;
		const windowEnd = midnight + LATEST_SHIFT_END;
		sum += new Interval(windowStart, windowEnd).cut(interval).size();
		day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 0, 0, 0, 0);
	}
	return sum;
}

async function writeAvailabilityCovering(interval: Interval, startOfMonth: number) {
	const prefactor = getPrefactor(interval);
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
			(prev, curr) => prev + (curr.count === 0 ? 0 : curr.interval.size()),
			0
		);
		if (prefactor === 0) {
			continue;
		}
		await db
			.insertInto('availabilityState')
			.values({
				company: company[0].company,
				startOfMonth,
				score: score * prefactor,
				prefactor
			})
			.execute();
	}
}

export async function captureAvailabilityState() {
	const now = Date.now();
	const nowDate = new Date(now);
	const endDate = new Date(now + AVAILABILITY_CONFIRMATION_DEADLINE);
	const startMonth = nowDate.getMonth();
	const endMonth = endDate.getMonth();
	const startOfStartMonth = new Date(nowDate.getUTCFullYear(), startMonth, 1, 0, 0, 0, 0).getTime();
	const startOfEndMonth = new Date(nowDate.getUTCFullYear(), endMonth, 1, 0, 0, 0, 0).getTime();

	const interval1 = new Interval(
		now,
		Math.min(now + AVAILABILITY_CONFIRMATION_DEADLINE, startOfEndMonth)
	);
	await writeAvailabilityCovering(interval1, startOfStartMonth);
	if (startMonth === endMonth) {
		return;
	}
	const interval2 = new Interval(
		Math.min(
			now + AVAILABILITY_CONFIRMATION_DEADLINE,
			startOfEndMonth,
			now + AVAILABILITY_CONFIRMATION_DEADLINE
		)
	);
	await writeAvailabilityCovering(interval2, startOfEndMonth);
}
