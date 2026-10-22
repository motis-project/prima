import { ALTERABLE_HORIZON, MIN_PREP } from '$lib/constants';
import { Interval } from './interval';
import { DAY, MINUTE, roundToUnit } from './time';

export function getAlterableTimeframe() {
	return new Interval(
		roundToUnit(Date.now() + MIN_PREP, 15 * MINUTE, Math.ceil),
		roundToUnit(Date.now() + ALTERABLE_HORIZON, DAY, Math.floor)
	);
}
