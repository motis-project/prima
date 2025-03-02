import { getCompanyCosts } from './getCompanyCosts';

export const load = async () => {
	const { tours, earliestTime, companyCostsPerDay } = await getCompanyCosts();
	return {
		// eslint-disable-next-line
		tours: tours.map(({ interval, ...rest }) => rest),
		earliestTime,
		companyCostsPerDay
	};
};
