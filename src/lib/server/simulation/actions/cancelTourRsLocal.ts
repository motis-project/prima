import { cancelRideShareTour } from '$lib/server/booking/rideShare/cancelRideShareTour';
import { getRideShareTours } from '$lib/server/util/getRideShareTours';
import { DAY } from '$lib/util/time';
import { randomInt } from '../randomInt';
import type { ActionResponse } from '../simulation';

export async function cancelTourRsLocal(customerId: number): Promise<ActionResponse> {
	const tours = await getRideShareTours(false, false);
	if (tours.length === 0) {
		return {
			lastActionSpecifics: null,
			success: false,
			error: false,
			atomicDurations: {} as Record<string, number>
		};
	}
	const r = randomInt(0, tours.length - 1);
	await cancelRideShareTour(tours[r].tourId, customerId);
	return {
		lastActionSpecifics: {
			vehicleId: tours[r].vehicleId,
			dayStart: Math.floor(tours[r].startTime / DAY) * DAY
		},
		success: true,
		error: false,
		atomicDurations: {} as Record<string, number>
	};
}
