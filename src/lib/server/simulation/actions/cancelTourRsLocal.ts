import { cancelRideShareTour } from '$lib/server/booking/rideShare/cancelRideShareTour';
import { getRideShareTours } from '$lib/server/util/getRideShareTours';
import { DAY } from '$lib/util/time';
import { randomInt } from '../randomInt';

export async function cancelTourRsLocal() {
	const tours = await getRideShareTours(false, false);
	if (tours.length === 0) {
		return false;
	}
	const r = randomInt(0, tours.length);
	await cancelRideShareTour(tours[r].tourId, 1);
	return { vehicleId: tours[r].vehicleId, dayStart: Math.floor(tours[r].startTime / DAY) * DAY };
}
