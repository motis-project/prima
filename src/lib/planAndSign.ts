import { type Itinerary, type PlanData, type PlanResponse } from './openapi';
import type { RideShareTourInfo } from './server/booking/rideShare/getRideShareInfo';

export type SignedItinerary = Itinerary & {
	signature1?: string;
	signature2?: string;
	rideShareTourInfoFirstLeg?: RideShareTourInfo;
	rideShareTourInfoLastLeg?: RideShareTourInfo;
};

export type SignedPlanResponse = Omit<PlanResponse, 'itineraries'> & {
	itineraries: SignedItinerary[];
};

export async function planAndSign(
	q: PlanData,
	baseUrl?: string
): Promise<undefined | SignedPlanResponse> {
	const result = await fetch(`${baseUrl ? baseUrl : ''}/api/planAndSign`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			...q
		})
	});
	const abc: undefined | SignedPlanResponse = await result.json();
	return await result.json();
}
