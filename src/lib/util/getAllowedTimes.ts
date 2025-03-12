import { Interval } from '$lib/server/util/interval';
import { DAY, HOUR } from './time';
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

	const earliestDay = Math.floor(earliest / DAY) * DAY;
	const latestDay = Math.floor(latest / DAY) * DAY + DAY;

	const noonEarliestDay = new Date(earliestDay + 12 * HOUR);

	const allowedTimes: Array<Interval> = [];
	for (let t = earliestDay; t < latestDay; t += DAY) {
		const offset =
			parseInt(
				noonEarliestDay.toLocaleString('de-DE', {
					hour: '2-digit',
					hour12: false,
					timeZone: 'Europe/Berlin'
				})
			) - 12;
		allowedTimes.push(new Interval(t + startOnDay - offset * HOUR, t + endOnDay - offset * HOUR));
		noonEarliestDay.setHours(noonEarliestDay.getHours() + 24);
	}
	return allowedTimes;
}
