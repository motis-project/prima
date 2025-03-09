import { getCompanyCosts } from '$lib/server/db/getCompanyCosts';

export const load = async () => {
	const { tours, earliestTime, latestTime, companyCostsPerDay } = await getCompanyCosts();
	return {
		tours: tours.map(({ interval: _, ...rest }) => rest),
		earliestTime,
		latestTime,
		companyCostsPerDay
	};
};
