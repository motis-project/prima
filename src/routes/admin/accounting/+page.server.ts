import { getCompanyCosts } from '$lib/server/db/getCompanyCosts';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	const { tours, earliestTime, latestTime, costPerDayAndVehicle } = await getCompanyCosts();
	return {
		tours: tours.map(({ interval: _, ...rest }) => rest),
		earliestTime,
		latestTime,
		costPerDayAndVehicle
	};
};
