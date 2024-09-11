import type { Capacities } from '$lib/capacities';
import type { Event } from '$lib/compositionTypes.js';

export type Range = {
	earliestPickup: number;
	latestDropoff: number;
};

export function capacitySimulation(
	capacities: Capacities,
	requiredNewEvent: Capacities,
	events: Event[]
) {
	const adjustValues = (capacities: Capacities, event: Event): void => {
		capacities.bikes += event.is_pickup ? event.capacities.bikes : -event.capacities.bikes;
		capacities.luggage += event.is_pickup ? event.capacities.luggage : -event.capacities.luggage;
		capacities.wheelchairs += event.is_pickup
			? event.capacities.wheelchairs
			: -event.capacities.wheelchairs;
		capacities.passengers += event.is_pickup
			? event.capacities.passengers
			: -event.capacities.passengers;
	};
	const isValid = (capacities: Capacities, required: Capacities): boolean => {
		return (
			capacities.bikes >= required.bikes &&
			capacities.wheelchairs >= required.wheelchairs &&
			capacities.luggage + capacities.passengers >= required.luggage + required.passengers &&
			capacities.passengers >= required.passengers
		);
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
