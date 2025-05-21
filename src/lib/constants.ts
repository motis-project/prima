import { HOUR, MINUTE } from '$lib/util/time';

export const TZ = 'Europe/Berlin';
export const LOCALE = 'de-DE';
export const MIN_PREP = 1 * HOUR;
export const MAX_TRAVEL = 1 * HOUR;
export const MAX_PASSENGER_WAITING_TIME_PICKUP = 10 * MINUTE;
export const MAX_PASSENGER_WAITING_TIME_DROPOFF = 10 * MINUTE;
export const WGS84 = 4326;
export const MAX_MATCHING_DISTANCE = 250;
export const COORDINATE_ROUNDING_ERROR_THRESHOLD = 0.00001;
export const PASSENGER_CHANGE_DURATION = 1 * MINUTE;
export const TAXI_DRIVING_TIME_COST_FACTOR = 1;
export const TAXI_WAITING_TIME_COST_FACTOR = 0.5;
export const PASSENGER_TIME_COST_FACTOR = 0;
export const BUFFER_TIME = 0;
export const EARLIEST_SHIFT_START = 4 * HOUR;
export const LATEST_SHIFT_END = 23 * HOUR;
export const CAP = 4000;
export const OVER_CAP_FACTOR = 0.25;
export const MONTHS = [
	'Januar',
	'Februar',
	'März',
	'April',
	'Mai',
	'Juni',
	'Juli',
	'August',
	'September',
	'Oktober',
	'November',
	'Dezember'
];
export const QUARTERS = ['Quartal 1', 'Quartal 2', 'Quartal 3', 'Quartal 4'];
