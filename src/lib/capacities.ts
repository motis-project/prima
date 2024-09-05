import type { Event } from '$lib/compositionTypes.js';

export class Capacity {
	wheelchairs!: number;
	bikes!: number;
	passengers!: number;
	luggage!: number;
}

export type Range = {
	earliestPickup: number;
	latestDropoff: number;
};

export class CapacitySimulation {
	constructor(
		bikeCapacity: number,
		wheelchairCapacity: number,
		seats: number,
		storageSpace: number
	) {
		this.bikeCapacity = bikeCapacity;
		this.wheelchairCapacity = wheelchairCapacity;
		this.seats = seats;
		this.storageSpace = storageSpace;
		this.bikes = 0;
		this.wheelchairs = 0;
		this.passengers = 0;
		this.luggage = 0;
	}
	private bikeCapacity: number;
	private wheelchairCapacity: number;
	private seats: number;
	private storageSpace: number;
	private bikes: number;
	private wheelchairs: number;
	private passengers: number;
	private luggage: number;

	private adjustValues(event: Event | Capacity) {
		if (event instanceof Capacity || event.is_pickup) {
			this.bikes += event.bikes;
			this.wheelchairs += event.wheelchairs;
			this.passengers += event.passengers;
			this.luggage += event.luggage;
		} else {
			this.bikes -= event.bikes;
			this.wheelchairs -= event.wheelchairs;
			this.passengers -= event.passengers;
			this.luggage -= event.luggage;
		}
	}

	private isValid(): boolean {
		return (
			this.bikeCapacity >= this.bikes &&
			this.wheelchairCapacity >= this.wheelchairs &&
			this.storageSpace + this.seats >= this.luggage + this.passengers &&
			this.seats >= this.passengers
		);
	}

	getPossibleInsertionRanges = (events: Event[], toInsert: Capacity): Range[] => {
		this.reset();
		const possibleInsertions: Range[] = [];
		this.adjustValues(toInsert);
		let start: number | undefined = undefined;
		for (let i = 0; i != events.length; i++) {
			this.adjustValues(events[i]);
			if (!this.isValid()) {
				if (start != undefined) {
					possibleInsertions.push({ earliestPickup: start, latestDropoff: i });
					start = undefined;
				}
				continue;
			}
			start = start == undefined ? i : start;
		}
		if (start != undefined) {
			possibleInsertions.push({ earliestPickup: start, latestDropoff: events.length });
		}
		return possibleInsertions;
	};

	private reset() {
		this.bikes = 0;
		this.wheelchairs = 0;
		this.passengers = 0;
		this.luggage = 0;
	}
}
