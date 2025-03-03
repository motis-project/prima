import { getCompanyCosts } from './getCompanyCosts';

export const load = async () => {
	const { tours, earliestTime, companyCostsPerDay } = await getCompanyCosts();
	return {
		tours: tours.map(({ interval: _, ...rest }) => rest),
		earliestTime,
		companyCostsPerDay
	};
};
