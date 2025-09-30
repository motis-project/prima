import type { Leg } from '$lib/openapi';
import { Mode } from '$lib/server/booking/mode';
import type { Coordinates } from '$lib/util/Coordinates';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';

export type ExpectedConnection = {
	start: Coordinates;
	target: Coordinates;
	startTime: UnixtimeMs;
	targetTime: UnixtimeMs;
	signature: string;
	startFixed: boolean;
	requestedTime: UnixtimeMs;
	mode: Mode;
};

export function expectedConnectionFromLeg(
	leg: Leg,
	signature: string | undefined,
	startFixed: boolean,
	requestedTime: number
): ExpectedConnection | null {
	if (leg.mode !== 'ODM' && leg.mode !== 'BUS') {
		//TODO  && leg.mode !== 'RIDE_SHARE'
		console.log('booking requests leg has unexpected mode');
		throw new Error();
	}
	const mode = leg.mode === 'ODM' ? Mode.TAXI : Mode.RIDE_SHARE;
	return signature
		? {
				start: { lat: leg.from.lat, lng: leg.from.lon, address: leg.from.name },
				target: { lat: leg.to.lat, lng: leg.to.lon, address: leg.to.name },
				startTime: new Date(leg.startTime).getTime(),
				targetTime: new Date(leg.endTime).getTime(),
				signature,
				startFixed,
				requestedTime,
				mode
			}
		: null;
}
