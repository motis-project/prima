import { type Itinerary } from '$lib/openapi';
import { isTaxiLeg, isOdmLeg } from '$lib/util/booking/checkLegType';

export function publicTransitOnly(i: Itinerary): boolean {
	for (const l of i.legs) {
		if (isOdmLeg(l)) {
			return false;
		}
	}
	return true;
}

export function usesTaxi(i: Itinerary): boolean {
	for (const l of i.legs) {
		if (isTaxiLeg(l)) {
			return true;
		}
	}
	return false;
}

export function isDirectTaxi(i: Itinerary): boolean {
	return usesTaxi(i) && i.legs.length === 1;
}
