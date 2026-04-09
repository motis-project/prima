import { db } from '$lib/server/db/index';
import {
	AVAILABILITY_CONFIRMATION_DEADLINE,
	EARLIEST_SHIFT_START,
	LATEST_SHIFT_END
} from '$lib/constants';
import { groupBy } from '$lib/util/groupBy';
import { DAY, HOUR } from '$lib/util/time';

export async function computeCompensation(timestamp: number) {
	const maximumPossibleAvailability =
		(AVAILABILITY_CONFIRMATION_DEADLINE * (LATEST_SHIFT_END + HOUR - EARLIEST_SHIFT_START + HOUR)) /
		DAY;
	const availabilityStates = await db
		.selectFrom('availabilityState')
		.where('availabilityState.takenAt', '>=', timestamp - AVAILABILITY_CONFIRMATION_DEADLINE)
		.where('availabilityState.takenAt', '<', timestamp)
		.select(['availabilityState.company', 'availabilityState.score'])
		.execute();
	const byCompany = groupBy(
		availabilityStates,
		(a) => a.company,
		(a) => a.score
	);
	const ret = new Array<{ availabilityPercent: number; company: number }>();
	for (const [company, scores] of byCompany) {
		const avgScore =
			scores.length === 0 ? 0 : scores.reduce((prev, curr) => prev + curr, 0) / scores.length;
		ret.push({ availabilityPercent: avgScore / maximumPossibleAvailability, company });
	}
	return ret;
}
