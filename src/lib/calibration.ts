import type { SignedItinerary, SignedPlanResponse } from './planAndSign';

export type CalibrationItinerary = SignedItinerary & {
	required: boolean;
	forbidden: boolean;
};

export function collectItineraries(
	baseResponse: SignedPlanResponse | undefined,
	routingResponses: Array<SignedPlanResponse | undefined>
): Array<CalibrationItinerary> {
	let itineraries = new Array<CalibrationItinerary>();

	if (baseResponse) {
		baseResponse.itineraries.forEach((i) => {
			itineraries.push({ ...i, required: true, forbidden: false } as CalibrationItinerary);
		});
	}

	routingResponses.forEach((value) => {
		if (value !== undefined) {
			value.itineraries.forEach((i) => {
				itineraries.push({ ...i, required: false, forbidden: false } as CalibrationItinerary);
			});
		}
	});

	return itineraries;
}
