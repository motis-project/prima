import { Interval } from '$lib/util/interval';
import { selectAvailabilities, selectTours } from '$lib/server/booking/taxi/getBookingAvailability';
import {
	AVAILABILITY_COMPENSATION_DOUBLE_WINDOW_END,
	AVAILABILITY_COMPENSATION_DOUBLE_WINDOW_START,
	AVAILABILITY_COMPENSATION_WINDOW_END,
	AVAILABILITY_COMPENSATION_WINDOW_START,
	AVAILABILITY_CONFIRMATION_DEADLINE,
	MAXIMUM_AVAILABILITY_IN_CONFIRMATION_DEADLINE
} from '$lib/constants';
import { db } from '$lib/server/db';
import { groupBy } from '$lib/util/groupBy';
import { getAllowedTimes } from '$lib/util/getAllowedTimes';
import { DAY, HOUR } from '$lib/util/time';
import { getOffset } from '$lib/util/getOffset';

export function getStartOfMonth(date: Date, next?: boolean) {
	const hoursOnDay = date.getTime() % DAY;
	const noon =
		date.getTime() - (hoursOnDay > 12 * HOUR ? hoursOnDay - 12 * HOUR : 12 * HOUR - hoursOnDay);
	const offset = getOffset(noon);
	const d = new Date(date.getTime() + offset);
	return new Date(d.getUTCFullYear(), d.getUTCMonth() + (next ? 1 : 0), 1, 0, 0, 0, 0).getTime();
}

export async function computeCompensation(startOfMonth?: number, selectedCompany?: number) {
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
		}
	}
	return ret;
}

export type AvailabilityScore = Awaited<ReturnType<typeof computeCompensation>>[0];

function getPrefactor(interval: Interval): number {
	function intervalToCumulatedDuration(
		interval: Interval,
		dailyWindowStart: number,
		dailyWindowEnd: number
	) {
		return Interval.intersect(
			[new Interval(interval.startTime, interval.endTime)],
			getAllowedTimes(start.getTime(), end.getTime(), dailyWindowStart, dailyWindowEnd)
		).reduce((prev, curr) => prev + curr.size(), 0);
	}
	const start = new Date(interval.startTime);
	const end = new Date(interval.endTime);
	const i = new Interval(start.getTime(), end.getTime());
	return (
		intervalToCumulatedDuration(
			i,
			AVAILABILITY_COMPENSATION_WINDOW_START,
			AVAILABILITY_COMPENSATION_WINDOW_END
		) +
		intervalToCumulatedDuration(
			i,
			AVAILABILITY_COMPENSATION_DOUBLE_WINDOW_START,
			AVAILABILITY_COMPENSATION_DOUBLE_WINDOW_END
		)
	);
}

function computeScore(
	company: Vehicle[],
	interval: Interval,
	dailyWindowStart: number,
	dailyWindowEnd: number
) {
	const vehicleIntervals = company
		.flatMap((vehicle) =>
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
		)
		.map((i) => {
			const allowed = getAllowedTimes(i.startTime, i.endTime, dailyWindowStart, dailyWindowEnd);
			if (allowed.length === 0) {
				return undefined;
			}
			return i.intersect(allowed[0]);
		})
		.filter((i) => i !== undefined);
	const withCounts = Interval.aggregate(vehicleIntervals);
	return withCounts.reduce((prev, curr) => prev + (curr.count === 0 ? 0 : curr.interval.size()), 0);
}

async function query(interval: Interval) {
	return await db
		.selectFrom('vehicle')
		.select((eb) => [
			'vehicle.company',
			'vehicle.id as vehicle',
			selectAvailabilities(eb, interval),
			selectTours(eb, interval)
		])
		.execute();
}

type Vehicle = Awaited<ReturnType<typeof query>>[0];

async function writeAvailabilityCovering(
	interval: Interval,
	startOfMonth: number,
	skipWriting: boolean
) {
	const prefactor = getPrefactor(interval) / MAXIMUM_AVAILABILITY_IN_CONFIRMATION_DEADLINE;
	const vehicles = await query(interval);
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
		const score =
			computeScore(
				company,
				interval,
				AVAILABILITY_COMPENSATION_WINDOW_START,
				AVAILABILITY_COMPENSATION_WINDOW_END
			) +
			computeScore(
				company,
				interval,
				AVAILABILITY_COMPENSATION_DOUBLE_WINDOW_START,
				AVAILABILITY_COMPENSATION_DOUBLE_WINDOW_END
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
	const startOfStartMonth = getStartOfMonth(nowDate);
	const startOfNextMonth = getStartOfMonth(nowDate, true);
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
	if (startOfStartMonth === startOfEndMonth) {
		return snapshot1;
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
	return snapshot1.concat(snapshot2);
}

export async function getSnapshot(companyId: number): Promise<number> {
	const snaps = await captureAvailabilityState(true);
	const relevantSnaps = snaps.filter((s) => s.company === companyId) ?? undefined;
	return relevantSnaps
		? relevantSnaps.reduce(
				(prev, curr) => prev + curr.score / MAXIMUM_AVAILABILITY_IN_CONFIRMATION_DEADLINE,
				0
			) / relevantSnaps.reduce((prev, curr) => prev + curr.prefactor, 0)
		: 0;
}
