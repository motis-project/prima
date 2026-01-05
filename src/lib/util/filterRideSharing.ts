import { type Itinerary } from '$lib/openapi';
import { isRideShareLeg, isOdmLeg } from '$lib/util/booking/checkLegType';
import { dominanceFilter } from '$lib/util/dominanceFilter';

export function filterRideSharing(itineraries: Array<Itinerary>): Array<Itinerary> {
	return dominanceFilter(dominanceFilter(itineraries, publicTransitDominates), rideShareDominates);
}

function publicTransitDominates(a: Itinerary, b: Itinerary): boolean {
	return publicTransitOnly(a) && usesRideSharing(b) && paretoDominates(a, b);
}

function rideShareDominates(a: Itinerary, b: Itinerary): boolean {
	return usesSameTour(a, b) && paretoDominates(a, b);
}

function publicTransitOnly(i: Itinerary): boolean {
	for (const l of i.legs) {
		if (isOdmLeg(l)) {
			return false;
		}
	}
	return true;
}

function usesRideSharing(i: Itinerary): boolean {
	for (const l of i.legs) {
		if (isRideShareLeg(l)) {
			return true;
		}
	}
	return false;
}

function usesSameTour(a: Itinerary, b: Itinerary): boolean {
	for (const x of a.legs) {
		if (isRideShareLeg(x) && 'tripId' in x && typeof x.tripId === 'string') {
			const xProperties = JSON.parse(x.tripId);
			if (!('tour' in xProperties) || typeof xProperties.tour !== 'number') {
				continue;
			}
			for (const y of b.legs) {
				if (isRideShareLeg(y) && 'tripId' in y && typeof y.tripId === 'string') {
					const yProperties = JSON.parse(y.tripId);
					if (!('tour' in yProperties) || typeof yProperties.tour !== 'number') {
						continue;
					}
					if (xProperties.tour === yProperties.tour) {
						return true;
					}
				}
			}
		}
	}
	return false;
}

function paretoDominates(a: Itinerary, b: Itinerary): boolean {
	return (
		a.startTime >= b.startTime &&
		a.endTime <= b.endTime &&
		a.transfers <= b.transfers &&
		(a.startTime > b.startTime || a.endTime < b.endTime || a.transfers < b.transfers)
	);
}
