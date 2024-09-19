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
	companyFn: (c: Company, companyPos: number) => number,
	vehicleFn: (v: Vehicle) => void,
	insertionFn: (events: Event[], insertionIdx: number, companyPos: number, eventPos: number) => number
) {
	let companyPos = 0;
	let eventPos = 0;
	companies.forEach((company) => {
		eventPos = companyFn(company, companyPos);
		company.vehicles.forEach((vehicle) => {
			vehicleFn(vehicle);
			const events = vehicle.tours.flatMap((t) => t.events);
			insertions.get(vehicle.id)!.forEach((insertion) => {
				for (
					let insertionIdx = insertion.earliestPickup;
					insertionIdx != insertion.latestDropoff;
					++insertionIdx
				) {
					eventPos = insertionFn(events, insertionIdx, companyPos, eventPos);
				}
			});
		});
		companyPos = eventPos;
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
		.reduce((sum, current) => sum + current.latestDropoff - current.earliestPickup, 0);
	const insertionCount = (companies.length + eventInsertionCount) * (busStops.length +1);
	const busStopMany = new Array<Coordinates[]>(busStops.length);
	for(let i=0;i!=busStopMany.length;++i){
		busStopMany[i] = new Array<Coordinates>(insertionCount);
	}
	const userChosenMany = new Array<Coordinates>(insertionCount);
	iterateAllInsertions(
		companies,
		insertionsByVehicle,
		(company, companyPos) => {
			for (let busStopIdx = 0; busStopIdx != busStops.length; ++busStopIdx) {
				busStopMany[busStopIdx][companyPos++] = company.coordinates;
				console.log("companyPos: ", companyPos);
			}
			userChosenMany[companyPos++] = company.coordinates;
			console.log("companyPos: ", companyPos);
			return companyPos;
		},
		(_) => {},
		(events, insertionIdx, _, eventPos) => {
			const eventCoordinates = events[insertionIdx].coordinates;
			for (let busStopIdx = 0; busStopIdx != busStops.length; ++busStopIdx) {
				busStopMany[busStopIdx][eventPos++] = eventCoordinates;
				console.log("eventPos: ", eventPos);
			}
			userChosenMany[eventPos++] = eventCoordinates;
			console.log("eventPos: ", eventPos);
			return eventPos;
		}
	);
	console.log(insertionCount);
	console.log("user", userChosenMany);
	return {
		busStopMany,
		userChosenMany
	};
}
