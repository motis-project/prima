import type { Leg } from '$lib/openapi/types.gen';
import type { LegLike } from '$lib/ui/modeStyle';

export function isRideShareLeg(l: Leg | LegLike) {
	return l.mode == 'RIDE_SHARING';
}

export function isTaxiLeg(l: Leg | LegLike) {
	return l.mode == 'ODM';
}

export function isOdmLeg(l: Leg | LegLike) {
	return l.mode == 'ODM' || l.mode == 'RIDE_SHARING';
}

export function isPoolingLeg(l: Leg | LegLike) {
	return l.displayName == 'POOLING';
}
