import { hoursToMs, minutesToMs } from './time_utils';

export const TZ = 'Europe/Berlin';
export const MIN_PREP_MINUTES = 30;
export const MAX_TRAVEL_DURATION = hoursToMs(1);
export const MAX_PASSENGER_WAITING_TIME_PICKUP = minutesToMs(10);
export const MAX_PASSENGER_WAITING_TIME_DROPOFF = minutesToMs(10);
export const SRID = 4326;
export const PASSENGER_CHANGE_TIME = minutesToMs(2);
export const TAXI_DRIVING_TIME_COST_FACTOR = 1;
export const TAXI_WAITING_TIME_COST_FACTOR = 0.2;
export const PASSENGER_TIME_COST_FACTOR = 1;
