import { TZ } from '$lib/constants';
import type { UnixtimeMs } from './UnixtimeMs';

export const SECOND = 1000;
export const MINUTE = SECOND * 60;
export const HOUR = MINUTE * 60;
export const DAY = HOUR * 24;

export function milliToSecond(milli: number): number {
	return Math.floor(milli / SECOND);
}

export function secondToMilli(second: number): number {
	return second * SECOND;
}

export function roundToUnit(n: number, unit: number, roundFn: (n: number) => number) {
	return roundFn(n / unit) * unit;
}

export const getOffset = (t: UnixtimeMs) => {
	return (
		HOUR *
		(parseInt(
			new Date(t).toLocaleString('de-DE', {
				hour: '2-digit',
				hour12: false,
				timeZone: TZ
			})
		) -
			12)
	);
};
