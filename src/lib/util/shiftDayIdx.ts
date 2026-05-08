import { REPEATING_DAY_SHIFT } from '$lib/constants';

export function shiftDayIdxForward(idx: number) {
	return (idx + REPEATING_DAY_SHIFT) % 7;
}

export function shiftDayIdxBackward(idx: number) {
	return (idx + 7 - REPEATING_DAY_SHIFT) % 7;
}
