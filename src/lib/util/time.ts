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

export function endOfCurrent15MinuteInterval() {
	return Math.ceil(Date.now() / (15 * MINUTE)) * 15 * MINUTE;
}
