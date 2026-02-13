import { getToursWithRequests } from '$lib/server/db/getTours';
import { moveTour } from '$lib/server/moveTour';
import { DAY } from '$lib/util/time';
import { randomInt } from '../randomInt';

export async function moveTourLocal() {
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
	const tour = tours[r];
	await moveTour(tour.tourId, tour.vehicleId, tour.companyId);
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
