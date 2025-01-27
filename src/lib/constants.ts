import { MINUTE, secondToMilli } from '$lib/util/time';

export const TZ = 'Europe/Berlin';
export const MIN_PREP_MINUTES = 30;
export const MAX_TRAVEL_SECONDS = 3600;
export const MAX_TRAVEL_MS = secondToMilli(MAX_TRAVEL_SECONDS);
export const MAX_PASSENGER_WAITING_TIME_PICKUP = 10 * MINUTE;
export const MAX_PASSENGER_WAITING_TIME_DROPOFF = 10 * MINUTE;
export const WGS84 = 4326;
export const MOTIS_BASE_URL = 'https://europe.motis-project.de';
export const MAX_MATCHING_DISTANCE = 200;
