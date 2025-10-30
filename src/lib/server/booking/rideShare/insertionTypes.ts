import type { Range } from '$lib/util/booking/getPossibleInsertions';
import type { RideShareEvent } from './getRideShareTours';

export type InsertionInfo = {
	rideShareTourIdx: number;
	events: RideShareEvent[];
	idxInEvents: number;
	insertionIdx: number;
	currentRange: Range;
	provider: number;
	vehicle: number;
	tourId: number;
};
