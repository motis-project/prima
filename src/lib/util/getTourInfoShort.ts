import type { Tour } from '$lib/server/db/getTours';

export const getTourInfoShort = (tour: Tour) => {
	const from = tour.events[0];
	const to = tour.events[tour.events.length - 1];
	return {
		from: from.city ? from.city + ': ' : '' + from.street,
		to: to.city ? to.city + ': ' : '' + to.street
	};
};
