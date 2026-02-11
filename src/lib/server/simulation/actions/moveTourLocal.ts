import { getToursWithRequests } from '$lib/server/db/getTours';
import { moveTour } from '$lib/server/moveTour';
import { DAY } from '$lib/util/time';
import { randomInt } from '../randomInt';

export async function moveTourLocal() {
	const tours = await getToursWithRequests(false);
	if (tours.length === 0) {
		return false;
	}
	const r = randomInt(0, tours.length);
	const tour = tours[r];
	await moveTour(tour.tourId, tour.vehicleId, tour.companyId);
	return { vehicleId: tour.vehicleId, dayStart: Math.floor(tour.startTime / DAY) * DAY };
}
