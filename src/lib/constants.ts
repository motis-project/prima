import { HOUR, MINUTE } from '$lib/util/time';

export const TZ = 'Europe/Berlin';
export const LOCALE = 'de-DE';
export const MIN_PREP = HOUR;
export const MAX_TRAVEL = HOUR;
export const SCHEDULED_TIME_BUFFER_PICKUP = 1 * MINUTE;
export const SCHEDULED_TIME_BUFFER_DROPOFF_RELATIVE = 0.35;
export const MAX_PASSENGER_WAITING_TIME_PICKUP = 20 * MINUTE;
export const MAX_PASSENGER_WAITING_TIME_DROPOFF = 20 * MINUTE;
export const WGS84 = 4326;
export const MAX_MATCHING_DISTANCE = 250;
export const COORDINATE_ROUNDING_ERROR_THRESHOLD = 0.00001;
export const PASSENGER_CHANGE_DURATION = MINUTE;
export const FULLY_PAYED_COST_FACTOR = 1;
export const APPROACH_AND_RETURN_TIME_COST_FACTOR = 0.6;
export const TAXI_WAITING_TIME_COST_FACTOR = 0.2;
export const PASSENGER_TIME_COST_FACTOR = 0.2;
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
export const DIRECT_FREQUENCY = 5 * MINUTE;
export const MOTIS_SHIFT = 5 * MINUTE;
export const DIRECT_RIDE_TIME_DIFFERENCE = HOUR;
export const MAX_WAITING_TIME = 47 * MINUTE;
const EXPECTED_AVERAGE_KM_PER_H = 60;
export const PROFIT_PER_TIME = centsToCentsPerMs(30);
export const BASE_PROFIT = 200;
const FUEL_COST = centsToCentsPerMs(18);
export const COST_PER_WAITING_TIME = 1000 / HOUR;
export const COST_PER_DRIVING_TIME = COST_PER_WAITING_TIME + FUEL_COST;
export const MINIMUM_PROFIT = 0;

function centsToCentsPerMs(cents: number) {
	return (cents * EXPECTED_AVERAGE_KM_PER_H) / HOUR;
}
export const LICENSE_PLATE_REGEX = /^([A-ZÄÖÜ]{1,3})-([A-ZÄÖÜ]{1,2})-([0-9]{1,4})$/;
export const defaultProfilePicture = '/user-default.jpg';
export const defaultCarPicture = '/car-default.jpg';
export const LICENSE_PLATE_PLACEHOLDER = 'WSW-AB-1234';
