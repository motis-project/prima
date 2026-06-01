import { MIN_PREP } from '$lib/constants';
import { Interval } from './interval';
import { MINUTE, roundToUnit } from './time';

export function getAlterableTimeframe() {
	return new Interval(
		roundToUnit(Date.now() + MIN_PREP, 15 * MINUTE, Math.ceil),
		new Date('2026-11-01T00:00:00.000Z').getTime()
	);
}
