import { Interval } from '$lib/util/interval';
import { getOffset } from './getOffset';
import { DAY, HOUR, roundToUnit } from './time';
import type { UnixtimeMs } from './UnixtimeMs';

export function getAllowedTimes(
	earliest: UnixtimeMs,
	latest: UnixtimeMs,
	startOnDay: UnixtimeMs,
	endOnDay: UnixtimeMs
): Interval[] {
	if (earliest >= latest) {
		return [];
	}

	const earliestDay = roundToUnit(earliest, DAY, Math.floor);
	const latestDay = roundToUnit(latest, DAY, Math.floor) + DAY;

	const allowedTimes: Array<Interval> = [];
	for (let t = earliestDay; t < latestDay; t += DAY) {
		const noon = new Date(t + 12 * HOUR);
		const offset = getOffset(noon.getTime());
		allowedTimes.push(new Interval(t + startOnDay - offset, t + endOnDay - offset));
		noon.setHours(noon.getHours() + 24);
	}
	return allowedTimes;
}
