import { hoursToMs, minutesToMs } from './time_utils';

export const TZ = 'Europe/Berlin';
export const MIN_PREP_MINUTES = 30;
export const MAX_TRAVEL_DURATION = hoursToMs(1);
export const MAX_PASSENGER_WAITING_TIME = minutesToMs(10);
export const SRID = 4326;
