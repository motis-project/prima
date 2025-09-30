import type { UnixtimeMs } from '$lib/util/UnixtimeMs';

export type PromisedTimesRideShare = {
	pickup: UnixtimeMs;
	dropoff: UnixtimeMs;
	tourId: number;
};
