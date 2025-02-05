import { HOUR, MINUTE } from '$lib/util/time';

export const TZ = 'Europe/Berlin';
export const MIN_PREP = 30 * MINUTE;
export const MAX_TRAVEL = 1 * HOUR;
export const MAX_PASSENGER_WAITING_TIME_PICKUP = 10 * MINUTE;
export const MAX_PASSENGER_WAITING_TIME_DROPOFF = 10 * MINUTE;
export const WGS84 = 4326;
export const MOTIS_BASE_URL = 'https://europe.motis-project.de';
export const MAX_MATCHING_DISTANCE = 200;
export const COORDINATE_ROUNDING_ERROR_THRESHOLD = 0.00001;
export const PASSENGER_CHANGE_DURATION = 2 * MINUTE;
export const TAXI_DRIVING_TIME_COST_FACTOR = 1;
export const TAXI_WAITING_TIME_COST_FACTOR = 0.5;
export const PASSENGER_TIME_COST_FACTOR = 0;
export const BUFFER_TIME = 4 * MINUTE;
