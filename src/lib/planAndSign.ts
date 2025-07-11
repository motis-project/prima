import { type Itinerary, type PlanData, type PlanResponse } from './openapi';

export type SignedItinerary = Itinerary & { signature1?: string; signature2?: string };

export type SignedPlanResponse = Omit<PlanResponse, 'itineraries'> & {
	itineraries: SignedItinerary[];
};

export async function planAndSign(q: PlanData): Promise<undefined | SignedPlanResponse> {
	const result = await fetch('/api/planAndSign', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			...q
		})
	});
	return await result.json();
}
