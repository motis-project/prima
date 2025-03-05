import type { UnixtimeMs } from "./UnixtimeMs";

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

export function getOffset(t: UnixtimeMs) {
	return parseInt(new Date(Math.floor(t / DAY) * DAY + 12 * HOUR).toLocaleString('de-DE', {
		hour: '2-digit',
		hour12: false,
		timeZone: 'Europe/Berlin'
	})) - 12;
};
