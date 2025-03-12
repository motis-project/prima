import type { TourWithRequests } from '$lib/util/getToursTypes';

export const getTourInfoShort = (tour: TourWithRequests) => {
	const events = tour.requests.flatMap((r) => r.events);
	if (events.length === 0) {
		return { from: '???', to: '???' };
	}
	return {
		from: events[0].address,
		to: events[events.length - 1].address
	};
};
