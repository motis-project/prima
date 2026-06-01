import { cancelTour } from '$lib/server/cancelTour';
import { getToursWithRequests } from '$lib/server/db/getTours';
import { DAY } from '$lib/util/time';
import { randomInt } from '../randomInt';

export async function cancelTourLocal() {
	const tours = await getToursWithRequests(false);
	if (tours.length === 0) {
		return {
			lastActionSpecifics: null,
			success: false,
			error: false,
			atomicDurations: {} as Record<string, number>
		};
	}
	const r = randomInt(0, tours.length - 1);
	await cancelTour(tours[r].tourId, 'message', tours[r].companyId);
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
