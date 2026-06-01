import type { SignedItinerary, SignedPlanResponse } from './planAndSign';

export type CalibrationItinerary = SignedItinerary & {
	keep: boolean;
	remove: boolean;
	fulfilled: boolean;
};

export function collectItineraries(
	routingResponses: Array<SignedPlanResponse | undefined>
): Array<CalibrationItinerary> {
	const itineraries = new Array<CalibrationItinerary>();

	for (const r of routingResponses) {
		if (r != undefined) {
			for (const i of r.itineraries) {
				itineraries.push({ ...i, keep: false, remove: false } as CalibrationItinerary);
			}
		}
	}

	return itineraries;
}

export function deduplicate(itineraries: Array<CalibrationItinerary>): Array<CalibrationItinerary> {
	const isDuplicate = Array<boolean>(itineraries.length);
	for (let i = 0; i < itineraries.length; ++i) {
		if (isDuplicate[i]) {
			continue;
		}
		const first = JSON.stringify(itineraries[i]);
		for (let j = i + 1; j < itineraries.length; ++j) {
			if (isDuplicate[j]) {
				continue;
			}
			isDuplicate[j] = first === JSON.stringify(itineraries[j]);
		}
	}
	return itineraries.filter((_, i) => {
		return !isDuplicate[i];
	});
}
