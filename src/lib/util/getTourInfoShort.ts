import type { Tour } from '$lib/server/db/getTours';

export const getTourInfoShort = (tour: Tour) => {
	console.log(tour.events[0].address);
	console.log(tour.events[tour.events.length - 1].address);
	return {
		from: tour.events[0].address,
		to: tour.events[tour.events.length - 1].address
	};
};
