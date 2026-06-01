import { computeCompensation } from '$lib/server/availabilityCompensation/availabilityCompensation.js';
import { getCompanyCosts } from '$lib/server/db/getCompanyCosts';
import type { PageServerLoad, RequestEvent } from './$types.js';

export const load: PageServerLoad = async (event: RequestEvent) => {
	const url = event.url;
	const tourParam = url.searchParams.get('tourId');
	const tourId = tourParam === null || isNaN(parseInt(tourParam)) ? undefined : parseInt(tourParam);

	const companyId = event.locals.session!.companyId!;
	const { tours, earliestTime, latestTime, costPerDayAndVehicle } =
		await getCompanyCosts(companyId);
	const availabilityPercent = (
		await computeCompensation(undefined, event.locals.session!.companyId!)
	).filter((c) => companyId === c.company);
	return {
		tours: tours.map(({ interval: _, ...rest }) => rest),
		earliestTime,
		latestTime,
		costPerDayAndVehicle,
		tourId,
		availabilityPercent
	};
};
