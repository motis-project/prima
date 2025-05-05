import { getCompanyCosts } from '$lib/server/db/getCompanyCosts';
import type { PageServerLoad, RequestEvent } from './$types.js';

export const load: PageServerLoad = async (event: RequestEvent) => {
	const { tours, earliestTime, latestTime, costPerDayAndVehicle } = await getCompanyCosts();
	const url = event.url;
	const tourParam = url.searchParams.get('tourId');
	const tourId = tourParam === null || isNaN(parseInt(tourParam)) ? undefined : parseInt(tourParam);
	return {
		tours: tours.map(({ interval: _, ...rest }) => rest),
		earliestTime,
		latestTime,
		costPerDayAndVehicle,
		tourId
	};
};
