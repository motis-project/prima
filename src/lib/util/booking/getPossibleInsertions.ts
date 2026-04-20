import type { RideShareEvent } from '$lib/server/booking/rideShare/getRideShareTours';
import type { Capacities } from './Capacities';

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

type Event = Capacities & { isPickup: boolean, scheduledTimeStart: number, eventGroupId: number };

export function getPossibleInsertions(
	taxiCapacities: Capacities,
	requestCapacities: Capacities,
	events: (Event | RideShareEvent)[]
) {
	if (events.length == 0 || !isValid(taxiCapacities, requestCapacities)) {
		return [];
	}
	const sortedEvents = events.sort((e1,e2) => {
		if(e1.eventGroupId !== e2.eventGroupId) {
			return e1.scheduledTimeStart - e2.scheduledTimeStart;
		}
		const p1 = e1.isPickup ? 1 : -1;
		const p2 = e2.isPickup ? 1 : -1;
		return p1 - p2;
	});
	const updateCapacity = (capacities: Capacities, event: Event): void => {
		capacities.bikes += event.isPickup ? event.bikes : -event.bikes;
		capacities.luggage += event.isPickup ? event.luggage : -event.luggage;
		capacities.wheelchairs += event.isPickup ? event.wheelchairs : -event.wheelchairs;
		capacities.passengers += event.isPickup ? event.passengers : -event.passengers;
	};

	const current = { ...requestCapacities };
	const possibleInsertions: Range[] = [];
	let start: number | undefined = -1;
	for (let i = 0; i != sortedEvents.length; i++) {
		updateCapacity(current, sortedEvents[i]);

		if (!isValid(taxiCapacities, current) && start != undefined) {
			// End found, reset start.
			possibleInsertions.push({ earliestPickup: start + 1, latestDropoff: i });
			start = undefined;
		} else if (start == undefined) {
			// Start found. Will search for end.
			start = i;
		}
	}

	// Add end behind last event.
	if (start != undefined) {
		possibleInsertions.push({ earliestPickup: start + 1, latestDropoff: sortedEvents.length });
	}

	return possibleInsertions;
}
