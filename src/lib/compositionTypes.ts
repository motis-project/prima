import type { Interval } from '$lib/interval';
import type { Coordinates } from '$lib/location';

export type Company = {
	id: number;
	coordinates: Coordinates;
	vehicles: Vehicle[];
	zoneId: number;
};
export type Vehicle = {
	id: number;
	bike_capacity: number;
	storage_space: number;
	wheelchair_capacity: number;
	seats: number;
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
	passengers: number;
	luggage: number;
	wheelchairs: number;
	bikes: number;
	is_pickup: boolean;
	time: Interval;
	id: number;
	tourId: number;
	coordinates: Coordinates;
};
