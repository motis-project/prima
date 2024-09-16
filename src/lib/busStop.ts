import type { Coordinates } from './location';

export type BusStop = {
	coordinates: Coordinates;
	times: Date[];
};
