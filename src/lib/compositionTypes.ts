import type { Capacities } from './capacities';
import type { Interval } from './interval';
import type { Coordinates } from './location';

export type Company = {
	id: number;
	coordinates: Coordinates;
	vehicles: Vehicle[];
	zoneId: number;
};

export type Vehicle = {
	id: number;
	capacities: Capacities;
	tours: Tour[];
	availabilities: Interval[];
};

export type Tour = {
	departure: Date;
	arrival: Date;
	id: number;
	events: Event[];
};

export type Event = {
	capacities: Capacities;
	is_pickup: boolean;
	time: Interval;
	id: number;
	coordinates: Coordinates;
	tourId: number;
};
