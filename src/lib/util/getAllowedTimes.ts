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

	const noonEarliestDay = new Date(earliestDay + 12 * HOUR);

	const allowedTimes: Array<Interval> = [];
	for (let t = earliestDay; t < latestDay; t += DAY) {
		const offset = getOffset(noonEarliestDay.getTime());
		allowedTimes.push(new Interval(t + startOnDay - offset, t + endOnDay - offset));
		noonEarliestDay.setHours(noonEarliestDay.getHours() + 24);
	}
	return allowedTimes;
}
