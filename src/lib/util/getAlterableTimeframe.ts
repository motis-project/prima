import { MIN_PREP, AVAILABILITY_LOOKAHEAD } from '$lib/constants';
import { Interval } from './interval';
import { DAY, MINUTE, roundToUnit } from './time';

export function getAlterableTimeframe() {
	return new Interval(
		roundToUnit(Date.now() + MIN_PREP, 15 * MINUTE, Math.ceil),
		roundToUnit(Date.now(), DAY, Math.ceil) + AVAILABILITY_LOOKAHEAD
	);
}
