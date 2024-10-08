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
	events: Event[];
	availabilities: Interval[];
	lastEventBefore: Event | undefined;
	firstEventAfter: Event | undefined;
};

export type Tour = {
	arrival: Date;
	departure: Date;
};

export type Event = {
	capacities: Capacities;
	is_pickup: boolean;
	time: Interval;
	id: number;
	coordinates: Coordinates;
	tourId: number;
};
