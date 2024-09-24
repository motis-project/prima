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
	events: Event[];
	availabilities: Interval[];
};

export type Event = {
	capacities: Capacities;
	is_pickup: boolean;
	time: Interval;
	id: number;
	coordinates: Coordinates;
	tourId: number;
	arrival: Date;
	departure: Date;
	communicated: Date;
};
