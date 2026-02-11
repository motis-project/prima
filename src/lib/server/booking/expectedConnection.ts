import type { Leg } from '$lib/openapi';
import { Mode } from '$lib/server/booking/mode';
import { isOdmLeg, isRideShareLeg, isTaxiLeg } from '$lib/util/booking/checkLegType';
import type { Coordinates } from '$lib/util/Coordinates';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';
import type { Insertion } from './rideShare/insertion';

export type ExpectedConnection = {
	start: Coordinates;
	target: Coordinates;
	startTime: UnixtimeMs;
	targetTime: UnixtimeMs;
	signature: string;
	startFixed: boolean;
	requestedTime: UnixtimeMs;
	pickupTime?: UnixtimeMs;
	dropoffTime?: UnixtimeMs;
	tourId?: number;
	mode: Mode;
};

export type TripId = Insertion & {
	requestedTime: number;
};

export function expectedConnectionFromLeg(
	leg: Leg,
	signature: string | undefined,
	startFixed: boolean,
	requestedTime: number
): ExpectedConnection | null {
	if (!isOdmLeg(leg)) {
		console.log('booking requests leg has unexpected mode');
		throw new Error();
	}
	const mode = isTaxiLeg(leg) ? Mode.TAXI : Mode.RIDE_SHARE;
	const context = leg.tripId && isRideShareLeg(leg) ? JSON.parse(leg.tripId) : undefined;
	const reqTime =
		leg.tripId && isTaxiLeg(leg) ? (JSON.parse(leg.tripId) as TripId).requestedTime : undefined;
	return signature
		? {
				start: { lat: leg.from.lat, lng: leg.from.lon, address: leg.from.name },
				target: { lat: leg.to.lat, lng: leg.to.lon, address: leg.to.name },
				startTime: new Date(leg.startTime).getTime(),
				targetTime: new Date(leg.endTime).getTime(),
				signature,
				startFixed,
				requestedTime: context?.rT ?? reqTime ?? requestedTime,
				pickupTime: context?.pT,
				dropoffTime: context?.dT,
				tourId: context?.tour,
				mode
			}
		: null;
}
