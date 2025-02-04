import type { TourEvent } from '$lib/server/db/getTours';
import type { Capacities } from '$lib/booking/Capacities';

export type Range = {
	earliestPickup: number;
	latestDropoff: number;
};

export const isValid = (capacities: Capacities, required: Capacities): boolean => {
	return (
		capacities.bikes >= required.bikes &&
		capacities.wheelchairs >= required.wheelchairs &&
		capacities.luggage + capacities.passengers >= required.luggage + required.passengers &&
		capacities.passengers >= required.passengers
	);
};

export function capacitySimulation(
	capacities: Capacities,
	requiredNewEvent: Capacities,
	events: TourEvent[]
) {
	if (events.length == 0) {
		return [];
	}
	const adjustValues = (capacities: Capacities, event: TourEvent): void => {
		capacities.bikes += event.isPickup ? event.bikes : -event.bikes;
		capacities.luggage += event.isPickup ? event.luggage : -event.luggage;
		capacities.wheelchairs += event.isPickup
			? event.wheelchairs
			: -event.wheelchairs;
		capacities.passengers += event.isPickup ? event.passengers : -event.passengers;
	};
	const current = {
		wheelchairs: requiredNewEvent.wheelchairs,
		bikes: requiredNewEvent.bikes,
		luggage: requiredNewEvent.luggage,
		passengers: requiredNewEvent.passengers
	};
	const possibleInsertions: Range[] = [];
	let start: number | undefined = isValid(capacities, current) ? -1 : undefined;
	for (let i = 0; i != events.length; i++) {
		adjustValues(current, events[i]);
		if (!isValid(capacities, current)) {
			if (start != undefined) {
				possibleInsertions.push({ earliestPickup: start + 1, latestDropoff: i });
				start = undefined;
			}
			continue;
		}
		start = start == undefined ? i : start;
	}
	if (start != undefined) {
		possibleInsertions.push({ earliestPickup: start + 1, latestDropoff: events.length });
	}
	return possibleInsertions;
}
