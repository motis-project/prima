import { db } from '$lib/server/db';
import { getToursWithRequests } from '$lib/server/db/getTours';
import { moveTour } from '$lib/server/moveTour';
import { DAY } from '$lib/util/time';
import { randomInt } from '../randomInt';
import type { ActionResponse } from '../simulation';

export async function moveTourLocal(): Promise<ActionResponse> {
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
	const vehicleIds = (
		await db
			.selectFrom('vehicle')
			.where('vehicle.company', '=', tour.companyId)
			.where('vehicle.id', '!=', tour.vehicleId)
			.select('vehicle.id')
			.execute()
	).map((v) => v.id);
	if (vehicleIds.length === 0) {
		return {
			lastActionSpecifics: null,
			success: false,
			error: false,
			atomicDurations: {} as Record<string, number>
		};
	}
	const randomVehicleIdx = randomInt(0, vehicleIds.length - 1);
	const result = await moveTour(tour.tourId, vehicleIds[randomVehicleIdx], tour.companyId);
	if (result.status === 200) {
		return {
			lastActionSpecifics: {
				vehicleIds: [tours[r].vehicleId, vehicleIds[randomVehicleIdx]],
				dayStart: Math.floor(tours[r].startTime / DAY) * DAY
			},
			success: true,
			error: false,
			atomicDurations: {} as Record<string, number>
		};
	}
	console.log('Move tour local result: ', JSON.stringify(result, null, 2));
	return {
		lastActionSpecifics: null,
		success: false,
		error: result.status === 500,
		atomicDurations: {} as Record<string, number>
	};
}
