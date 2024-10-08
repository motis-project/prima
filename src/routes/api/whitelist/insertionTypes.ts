import type { Vehicle } from '$lib/compositionTypes';
import type { Range } from './capacitySimulation';

export type InsertionInfo = {
	companyIdx: number;
	prevEventIdxInRoutingResults: number;
	nextEventIdxInRoutingResults: number;
	vehicle: Vehicle;
	insertionIdx: number;
	currentRange: Range;
};
