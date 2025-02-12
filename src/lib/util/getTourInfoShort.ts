import type { Tour } from '$lib/server/db/getTours';

export const getTourInfoShort = (tour: Tour) => {
	if (tour.events.length === 0) {
		return { from: '???', to: '???' };
	}
	return {
		from: tour.events[0].address,
		to: tour.events[tour.events.length - 1].address
	};
}
