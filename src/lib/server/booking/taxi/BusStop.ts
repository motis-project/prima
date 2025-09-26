import type { Coordinates } from '$lib/util/Coordinates';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';

export type BusStop = Coordinates & {
	times: UnixtimeMs[];
};

export type BusStopWithISOStrings = Coordinates & {
	times: string[];
};

export function toBusStopWithISOStrings(busStop: BusStop): BusStopWithISOStrings {
	return {
		...busStop,
		times: busStop.times.map((t) => new Date(t).toISOString())
	};
}
