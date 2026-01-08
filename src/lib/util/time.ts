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

export function readTimeFromPageCursor(c: string): Date {
	return new Date(parseInt(c.split('|')[1]) * 1000);
}
