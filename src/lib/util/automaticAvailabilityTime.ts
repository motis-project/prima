import { MINUTE } from './time';

export const AUTOMATIC_AVAILABILITY_STEP = 15 * MINUTE;

export const isValidAutomaticAvailabilityTime = (
	value: number,
	minimum: number,
	maximum: number
): boolean =>
	Number.isInteger(value) &&
	value >= minimum &&
	value <= maximum &&
	value % AUTOMATIC_AVAILABILITY_STEP === 0;
