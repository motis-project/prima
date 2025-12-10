import { isSamePlace } from '$lib/util/booking/isSamePlace';
import type { Coordinates } from '../Coordinates';
import { MINUTE } from '../time';

export function matchesDesiredTrip(
	from: Coordinates | undefined,
	to: Coordinates | undefined,
	time: number,
	startFixed: boolean,
	luggage: number,
	passengers: number,
	desiredTrip: DesiredTrip
) {
	return (
		from !== undefined &&
		to !== undefined &&
		isSamePlace(from, { lat: desiredTrip.fromLat, lng: desiredTrip.fromLng }) &&
		isSamePlace(to, { lat: desiredTrip.toLat, lng: desiredTrip.toLng }) &&
		startFixed === desiredTrip.startFixed &&
		passengers === desiredTrip.passengers &&
		luggage === desiredTrip.luggage &&
		Math.abs(time - desiredTrip.time) <= 5 * MINUTE
	);
}

type DesiredTrip = {
	id: number;
	passengers: number;
	luggage: number;
	time: number;
	fromLat: number;
	fromLng: number;
	toLat: number;
	toLng: number;
	fromAddress: string;
	toAddress: string;
	startFixed: boolean;
	interestedUser: number;
};
