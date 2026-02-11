import { cancelTour } from '$lib/server/cancelTour';
import { getToursWithRequests } from '$lib/server/db/getTours';
import { DAY } from '$lib/util/time';
import { randomInt } from '../randomInt';

export async function cancelTourLocal() {
	const tours = await getToursWithRequests(false);
	if (tours.length === 0) {
		return false;
	}
	const r = randomInt(0, tours.length);
	await cancelTour(tours[r].tourId, 'message', tours[r].companyId);
	return { vehicleId: tours[r].vehicleId, dayStart: Math.floor(tours[r].startTime / DAY) * DAY };
}
