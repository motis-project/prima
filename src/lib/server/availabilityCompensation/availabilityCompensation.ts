import { Interval } from '$lib/util/interval';
import { selectAvailabilities, selectTours } from '$lib/server/booking/taxi/getBookingAvailability';
import {
	AVAILABILITY_COMPENSATION_WINDOW_END,
	AVAILABILITY_COMPENSATION_WINDOW_START,
	AVAILABILITY_CONFIRMATION_DEADLINE,
	MAXIMUM_AVAILABILITY_IN_CONFIRMATION_DEADLINE
} from '$lib/constants';
import { db } from '$lib/server/db';
import { groupBy } from '$lib/util/groupBy';

export function getStartOfMonth(date: Date) {
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0);
}

export async function computeCompensation(
	startOfMonth?: number,
	write?: boolean,
	selectedCompany?: number
) {
	const availabilityStates = await db
		.selectFrom('availabilityState')
		.$if(startOfMonth !== undefined, (qb) =>
			qb.where('availabilityState.startOfMonth', '=', startOfMonth!)
		)
		.$if(selectedCompany !== undefined, (qb) =>
			qb.where('availabilityState.company', '=', selectedCompany!)
		)
		.innerJoin('company', 'company.id', 'availabilityState.company')
		.selectAll('availabilityState')
		.select('company.name')
		.execute();
	const byCompany = groupBy(
		availabilityStates,
		(a) => a.company,
		(a) => ({ score: a.score, prefactor: a.prefactor, name: a.name, startOfMonth: a.startOfMonth })
	);
	const ret = new Array<{
		availabilityPercent: number;
		company: number;
		name: string | null;
		startOfMonth: number;
	}>();
	for (const [company, scores] of byCompany) {
		const byMonth = groupBy(
			scores,
			(s) => s.startOfMonth,
			(s) => s
		);
		for (const [_, scoresByMonth] of byMonth) {
			const preFactorSum = scoresByMonth.reduce((prev, curr) => prev + curr.prefactor, 0);
			const avgPrefactor = preFactorSum / scoresByMonth.length;
			const avgScore =
				(scoresByMonth.length === 0
					? 0
					: scoresByMonth.reduce((prev, curr) => prev + curr.prefactor * curr.score, 0) /
						preFactorSum) /
				MAXIMUM_AVAILABILITY_IN_CONFIRMATION_DEADLINE /
				avgPrefactor;

			ret.push({
				availabilityPercent: avgScore,
				company,
				name: scoresByMonth[0].name,
				startOfMonth: scoresByMonth[0].startOfMonth
			});

			if (write) {
				await db
					.insertInto('availabilityCompensation')
					.values({ score: avgScore, company, startOfMonth: startOfMonth ?? -1 })
					.execute();
			}
		}
	}
	return ret;
}

export type AvailabilityScore = Awaited<ReturnType<typeof computeCompensation>>[0];

function startOfDay(date: Date): number {
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0);
}

function getPrefactor(interval: Interval): number {
	const start = new Date(interval.startTime);
	const end = new Date(interval.endTime);
	let sum = 0;
	let day = startOfDay(start);

	while (day < end.getTime()) {
		const midnight = day;
		const windowStart = midnight + AVAILABILITY_COMPENSATION_WINDOW_START;
		const windowEnd = midnight + AVAILABILITY_COMPENSATION_WINDOW_END;
		const intersected = new Interval(windowStart, windowEnd).intersect(interval);
		sum += intersected ? intersected.size() : 0;

		const dayDate = new Date(day);
		day = Date.UTC(
			dayDate.getUTCFullYear(),
			dayDate.getUTCMonth(),
			dayDate.getUTCDate() + 1,
			0,
			0,
			0,
			0
		);
	}
	return sum;
}

async function writeAvailabilityCovering(
	interval: Interval,
	startOfMonth: number,
	skipWriting: boolean
) {
	const prefactor = getPrefactor(interval) / MAXIMUM_AVAILABILITY_IN_CONFIRMATION_DEADLINE;
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
	const ret = new Array<{
		company: number;
		takenAt: number;
		startOfMonth: number;
		score: number;
		prefactor: number;
	}>();
	for (const company of byCompany.values()) {
		if (company.length === 0) {
			continue;
		}
		const vehicleIntervals = company.flatMap((vehicle) =>
			Interval.merge(
				vehicle.tours
					.map((t) => new Interval(t.departure, t.arrival).intersect(interval))
					.concat(
						vehicle.availabilities.map((a) =>
							new Interval(a.startTime, a.endTime).intersect(interval)
						)
					)
					.filter((i) => i !== undefined)
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
		const v = {
			company: company[0].company,
			startOfMonth,
			score,
			prefactor,
			takenAt: Date.now()
		};
		ret.push(v);
		if (!skipWriting) {
			await db.insertInto('availabilityState').values(v).execute();
		}
	}
	return ret;
}

export async function captureAvailabilityState(skipWriting?: boolean) {
	const now = Date.now();
	const nowDate = new Date(now);
	const endDate = new Date(now + AVAILABILITY_CONFIRMATION_DEADLINE);
	const startMonth = nowDate.getUTCMonth();
	const endMonth = endDate.getUTCMonth();
	const startOfStartMonth = getStartOfMonth(nowDate);
	const startOfNextMonth = Date.UTC(nowDate.getUTCFullYear(), startMonth + 1, 1, 0, 0, 0, 0);
	const startOfEndMonth = getStartOfMonth(endDate);

	const interval1 = new Interval(
		now,
		Math.min(now + AVAILABILITY_CONFIRMATION_DEADLINE, startOfNextMonth)
	);
	const snapshot1 = await writeAvailabilityCovering(
		interval1,
		startOfStartMonth,
		skipWriting ?? false
	);
	if (startMonth === endMonth) {
		return { snapshot1 };
	}
	const interval2 = new Interval(
		Math.min(now + AVAILABILITY_CONFIRMATION_DEADLINE, startOfNextMonth),
		now + AVAILABILITY_CONFIRMATION_DEADLINE
	);
	const snapshot2 = await writeAvailabilityCovering(
		interval2,
		startOfEndMonth,
		skipWriting ?? false
	);
	return { snapshot1, snapshot2 };
}
