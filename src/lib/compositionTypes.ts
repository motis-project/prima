import type { Capacities } from './capacities';
import type { Interval } from './interval';
import type { Coordinates } from './location';

export type Event = {
	capacities: Capacities;
	is_pickup: boolean;
	time: Interval;
	id: number;
	coordinates: Coordinates;
	tourId: number;
};
