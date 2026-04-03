import { acceptRideShareRequest } from '$lib/server/booking';
import { getRideShareTours } from '$lib/server/util/getRideShareTours';
import { DAY } from '$lib/util/time';
import { randomInt } from '../randomInt';
import type { ActionResponse } from '../simulation';

export async function acceptRideShareRequestSimulation(
	customerId: number
): Promise<ActionResponse> {
	const tours = await getRideShareTours(false, true);
	const requests = tours.flatMap((t) => t.requests);
	if (requests.length === 0) {
		return {
			lastActionSpecifics: null,
			success: false,
			error: false,
			atomicDurations: {} as Record<string, number>
		};
	}
	const r = randomInt(0, requests.length - 1);
	const request = requests[r];
	const tour = tours.find((t) => t.requests.some((req) => request.requestId === req.requestId))!;
	const response = await acceptRideShareRequest(request.requestId, customerId);
	if (response.status === 200) {
		console.log(`Successfully accepted ride share request with idx ${request.requestId}.`);
		return {
			lastActionSpecifics: {
				vehicleId: tour.vehicleId,
				dayStart: Math.floor(tour.startTime / DAY) * DAY
			},
			success: true,
			error: false,
			atomicDurations: {} as Record<string, number>
		};
	}
	return {
		lastActionSpecifics: null,
		success: false,
		error: response.status !== 404,
		atomicDurations: {} as Record<string, number>
	};
}
