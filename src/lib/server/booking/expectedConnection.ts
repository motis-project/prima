import type { Leg } from '$lib/openapi';
import { Mode } from '$lib/server/booking/mode';
import { isOdmLeg, isTaxiLeg } from '$lib/util/booking/checkLegType';
import type { Coordinates } from '$lib/util/Coordinates';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';
import { parseTripId } from './tripId';

export type ExpectedConnection = {
	start: Coordinates;
	target: Coordinates;
	startTime: UnixtimeMs;
	targetTime: UnixtimeMs;
	signature: string;
	startFixed: boolean;
	requestedTime: UnixtimeMs;
	tourId?: number;
	mode: Mode;
};

export function expectedConnectionFromLeg(
	leg: Leg,
	signature: string | undefined,
	startFixed: boolean
): ExpectedConnection | null {
	if (!isOdmLeg(leg) || leg.tripId === undefined) {
		console.log('booking requests leg has unexpected mode tripId is missing. ', leg.tripId);
		throw new Error();
	}
	const isTaxi = isTaxiLeg(leg);
	const mode = isTaxi ? Mode.TAXI : Mode.RIDE_SHARE;
	const context = parseTripId(isTaxi, leg.tripId);
	return signature
		? {
				start: { lat: leg.from.lat, lng: leg.from.lon, address: leg.from.name },
				target: { lat: leg.to.lat, lng: leg.to.lon, address: leg.to.name },
				startTime: context.pT,
				targetTime: context.dT,
				signature,
				startFixed,
				requestedTime: context?.rT,
				tourId: context?.tour,
				mode
			}
		: null;
}
