import { getCompanyCosts } from '$lib/server/db/getCompanyCosts';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ locals }) => {
	const companyId = locals.session!.companyId!;
	const { tours, earliestTime, latestTime, costPerDayAndVehicle } =
		await getCompanyCosts(companyId);
	return {
		tours: tours.map(({ interval: _, ...rest }) => rest),
		earliestTime,
		latestTime,
		costPerDayAndVehicle
	};
};
