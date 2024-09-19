import type { BusStop } from '$lib/busStop';
import type { Company, Vehicle, Event } from '$lib/compositionTypes';
import { Coordinates } from '$lib/location';
import type { Range } from './capacitySimulation';

type RoutingCoordinates = {
	busStopMany: Coordinates[][];
	userChosenMany: Coordinates[];
};

function iterateAllInsertions(
	companies: Company[],
	insertions: Map<number, Range[]>,
	companyFn: (c: Company, companyPos: number) => void,
	vehicleFn: (v: Vehicle) => void,
	insertionFn: (events: Event[], insertionIdx: number, companyPos: number, eventPos: number) => void
) {
	let companyPos = 0;
	let eventPos = 0;
	companies.forEach((company) => {
		companyFn(company, companyPos);
		company.vehicles.forEach((vehicle) => {
			vehicleFn(vehicle);
			const events = vehicle.tours.flatMap((t) => t.events);
			eventPos = companyPos + 1;
			insertions.get(vehicle.id)!.forEach((insertion) => {
				for (
					let insertionIdx = insertion.earliestPickup;
					insertionIdx != insertion.latestDropoff;
					++insertionIdx
				) {
					insertionFn(events, insertionIdx, companyPos, eventPos);
					++eventPos;
				}
			});
		});
		companyPos = eventPos + 1;
	});
}

export function gatherRoutingCoordinates(
	companies: Company[],
	busStops: BusStop[],
	insertionsByVehicle: Map<number, Range[]>
): RoutingCoordinates {
	const eventInsertionCount = companies
		.flatMap((c) => c.vehicles)
		.flatMap((v) => insertionsByVehicle.get(v.id)!)
		.reduce((sum, current) => sum + current.earliestPickup - current.earliestPickup, 0);
	const insertionCount = companies.length + eventInsertionCount;
	const busStopMany = new Array<Coordinates[]>(busStops.length);
	busStopMany.forEach((b) => (b = new Array<Coordinates>(insertionCount)));
	const userChosenMany = new Array<Coordinates>(insertionCount);
	iterateAllInsertions(
		companies,
		insertionsByVehicle,
		(company, companyPos) => {
			for (let busStopIdx = 0; busStopIdx != busStops.length; ++busStopIdx) {
				busStopMany[busStopIdx][companyPos] = company.coordinates;
			}
			userChosenMany[companyPos++] = company.coordinates;
		},
		(_) => {},
		(events, insertionIdx, _, eventPos) => {
			const eventCoordinates = events[insertionIdx].coordinates;
			for (let busStopIdx = 0; busStopIdx != busStops.length; ++busStopIdx) {
				busStopMany[busStopIdx][eventPos] = eventCoordinates;
			}
			userChosenMany[eventPos++] = eventCoordinates;
		}
	);
	return {
		busStopMany,
		userChosenMany
	};
}
