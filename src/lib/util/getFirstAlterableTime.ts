import { MIN_PREP } from '$lib/constants';
import { MINUTE } from './time';

export function getFirstAlterableTime() {
	return Math.ceil((Date.now() + MIN_PREP) / (15 * MINUTE)) * 15 * MINUTE;
}
