import { type Itinerary } from '$lib/openapi';

export function dominanceFilter(
	itineraries: Array<Itinerary>,
	dominates: (a: Itinerary, b: Itinerary) => boolean
): Array<Itinerary> {
	return itineraries.filter((i) => !isDominated(i, itineraries, dominates));
}

function isDominated(
	i: Itinerary,
	itineraries: Array<Itinerary>,
	dominates: (a: Itinerary, b: Itinerary) => boolean
): boolean {
	for (let x of itineraries) {
		if (dominates(x, i)) {
			return true;
		}
	}
	return false;
}
