import type { Vehicle } from '$lib/compositionTypes';

export type InsertionInfo = {
	companyIdx: number;
	prevEventIdx: number;
	nextEventIdx: number;
	vehicle: Vehicle;
	insertionIdx: number;
};

export type InsertionEvaluation = {
	userChosen: TimeCost|undefined;
	busStops: TimeCost|undefined[][];
	both: TimeCost|undefined[][];
	approachDuration: number | undefined;
	returnDuration: number | undefined;
	company: number;
	vehicle: number;
	tour1: number;
	tour2: number;
	event1: number;
	event2: number;
};

export type TimeCost = {
	time: Date;
	cost: Cost;
};

export type Cost = {
	taxiWaitingTime: number;
	taxiDrivingDuration: number;
	passengerDuration: number;
	total: number;
};
