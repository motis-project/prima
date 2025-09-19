import { MAX_RANDOM_TIME } from '$lib/constants';
import type { Coordinates } from '$lib/util/Coordinates';
import { HOUR } from '$lib/util/time';
import MurmurHash3 from 'imurmurhash';

export function getRandomValue(
	company: Coordinates,
	start: Coordinates,
	target: Coordinates,
	time: number,
	startFixed: boolean
): number {
	const currentMidnight = new Date(time).setHours(0, 0, 0, 0);
	const t = Math.floor((time - currentMidnight) / (2 * HOUR)) * 2 * HOUR;
	const key = `${company.lat},${company.lng},${start.lat},${start.lng},${target.lat},${target.lng},${t},${startFixed}`;
	const hash = MurmurHash3(key).result();
	return ((hash >>> 0) / 0xffffffff) * MAX_RANDOM_TIME;
}
