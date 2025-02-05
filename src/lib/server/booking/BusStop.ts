import type { Coordinates } from '$lib/util/Coordinates';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';

export type BusStop = Coordinates & {
	times: UnixtimeMs[];
};
