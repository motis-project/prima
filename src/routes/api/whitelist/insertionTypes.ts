import type { Vehicle } from '$lib/compositionTypes';

export type InsertionInfo = {
	companyIdx: number;
	prevEventIdxInRoutingResults: number;
	nextEventIdxInRoutingResults: number;
	companyIdxInRoutingResults: number;
	vehicle: Vehicle;
	insertionIdx: number;
};
