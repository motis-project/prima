import { hoursToMs, minutesToMs } from './time_utils';

export const TZ = 'Europe/Berlin';
export const MIN_PREP_MINUTES = 30;
export const MAX_TRAVEL_DURATION = hoursToMs(1);
export const MAX_PASSENGER_WAITING_TIME_PICKUP = minutesToMs(10);
export const MAX_PASSENGER_WAITING_TIME_DROPOFF = minutesToMs(10);
export const SRID = 4326;
export const MOTIS_BASE_URL = 'https://europe.motis-project.de';
