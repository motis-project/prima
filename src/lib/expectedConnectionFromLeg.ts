import type { Leg } from './openapi';
import type { ExpectedConnection } from './server/booking/bookRide';

export function expectedConnectionFromLeg(
	leg: Leg,
	signature: string | undefined,
	startFixed: boolean,
	requestedTime: number
): ExpectedConnection | null {
	return signature
		? {
				start: { lat: leg.from.lat, lng: leg.from.lon, address: leg.from.name },
				target: { lat: leg.to.lat, lng: leg.to.lon, address: leg.to.name },
				startTime: new Date(leg.startTime).getTime(),
				targetTime: new Date(leg.endTime).getTime(),
				signature,
				startFixed,
				requestedTime
			}
		: null;
}
