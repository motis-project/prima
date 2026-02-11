import { acceptRideShareRequest } from '$lib/server/booking';
import { getRideShareTours } from '$lib/server/util/getRideShareTours';
import { DAY } from '$lib/util/time';
import { randomInt } from '../randomInt';

export async function acceptRideShareRequestLocal() {
	const tours = await getRideShareTours(false, true);
	const requests = tours.flatMap((t) => t.requests);
	if (requests.length === 0) {
		return false;
	}
	const r = randomInt(0, requests.length);
	const request = requests[r];
	const tour = tours.find((t) => t.requests.some((r) => r.requestId === r.requestId))!;
	const response = await acceptRideShareRequest(request.requestId, 1);
	if (response.status === 200) {
		console.log(`Successfully accepted ride share request with idx ${request.requestId}.`);
		return { vehicleId: tour.vehicleId, dayStart: Math.floor(tour.startTime / DAY) * DAY };
	}
	return response.status !== 404;
}
