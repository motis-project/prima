import type { UnixtimeMs } from '$lib/util/UnixtimeMs';

export type PromisedTimes = {
	pickup: UnixtimeMs;
	dropoff: UnixtimeMs;
};
