import type { SignedItinerary, SignedPlanResponse } from './planAndSign';

export type CalibrationItinerary = SignedItinerary & {
	required: boolean;
	forbidden: boolean;
};

export function collectItineraries(
	routingResponses: Array<SignedPlanResponse | undefined>
): Array<CalibrationItinerary> {
	let itineraries = new Array<CalibrationItinerary>();

	for (let r of routingResponses) {
		if (r != undefined) {
			for (let i of r.itineraries) {
				itineraries.push({ ...i, required: false, forbidden: false } as CalibrationItinerary);
			}
		}
	}

	return itineraries;
}
