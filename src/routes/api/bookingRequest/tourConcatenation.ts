import { Interval } from '$lib/interval.js';
import { Coordinates } from '$lib/location.js';
import { minutesToMs } from '$lib/time_utils.js';
import { Capacity, CapacitySimulation, type Range } from './capacities.js';
import { forEachVehicle } from './queries.js';
import { type Company, type Event } from '$lib/compositionTypes.js';
import type { SimpleEvent } from './+server.js';

type StartTimesWithDuration = {
	possibleStartTimes: Interval[];
	duration: number;
};

abstract class TCC {
	constructor() {
		this.oneRoutingResultIdx = undefined;
		this.manyRoutingResultIdx = undefined;
	}
	abstract getStartCoordinates(): Coordinates;
	abstract getTargetCoordinates(): Coordinates;
	oneRoutingResultIdx: number | undefined;
	manyRoutingResultIdx: number | undefined;
}

export class TourConcatenation {
	constructor(companyId: number, toIdx: number) {
		this.companyId = companyId;
		this.toIdx = toIdx;
		this.oneRoutingResultIdx = undefined;
		this.manyRoutingResultIdx = undefined;
		this.fullTravelDuration = undefined;
	}
	companyId: number;
	toIdx: number;
	oneRoutingResultIdx: number | undefined;
	manyRoutingResultIdx: number | undefined;
	fullTravelDuration: number | undefined;
	getStartCoordinates = (): Coordinates => {
		return new Coordinates(0, 0);
	};
	getTargetCoordinates = (): Coordinates => {
		return new Coordinates(0, 0);
	};
	getValidStarts(startFixed: boolean, availabilities: Interval[], arrivalTimes: Date[][]) {
		const PASSENGER_MAX_WAITING_TIME = minutesToMs(20);
		console.assert(this.fullTravelDuration != undefined);
		const validStarts = new Array<StartTimesWithDuration>(arrivalTimes.length);
		const times = arrivalTimes[this.toIdx];
		for (let t = 0; t != arrivalTimes.length; ++t) {
			const time = times[t];
			const searchInterval = startFixed
				? new Interval(new Date(time.getTime() - PASSENGER_MAX_WAITING_TIME), time)
				: new Interval(time, new Date(time.getTime() + PASSENGER_MAX_WAITING_TIME));
			const relevantAvailabilities = availabilities
				.filter((a) => a.size() >= this.fullTravelDuration!)
				.filter((a) => a.overlaps(searchInterval))
				.map((a) => (a.contains(searchInterval) ? a : a.cut(searchInterval)));
			if (relevantAvailabilities.length == 0) {
				validStarts[t] = {
					possibleStartTimes: [],
					duration: 0
				};
				continue;
			}
		}
		return validStarts;
	}
}

class NewTour extends TCC {
	constructor(companyId: number, toIdx: number, coordinates: Coordinates) {
		super();
		this.coordinates = coordinates;
	}
	coordinates: Coordinates;
	getStartCoordinates(): Coordinates {
		return this.coordinates;
	};
	getTargetCoordinates(): Coordinates {
		return this.coordinates;
	};
}

class BetweenEvents extends TourConcatenation {
	constructor(event1: Event, event2: Event, companyId: number) {
		super(companyId, 1);
		this.event1 = event1;
		this.event2 = event2;
	}
	event1: Event;
	event2: Event;
	getStartCoordinates = (): Coordinates => {
		return this.event1.coordinates;
	};
	getTargetCoordinates = (): Coordinates => {
		return this.event2.coordinates;
	};
}

class BetweenEventsConcatenationPair extends TourConcatenation {
	constructor(
		companyId: number,
		toIdx: number,
		vehicleId: number,
		insertion1: BetweenEvents,
		insertion2: BetweenEvents
	) {
		super(companyId, toIdx);
		this.firstInsert = insertion1;
		this.secondInsert = insertion2;
		this.vehicleId = vehicleId;
	}
	vehicleId: number;
	firstInsert: BetweenEvents;
	secondInsert: BetweenEvents;
}

class EventInsertion {
	constructor(
		event1: Event | undefined,
		event2: Event | undefined,
		companyId: number,
		vehicleId: number,
		type: string,
		idx: number
	) {
		this.event1 = event1;
		this.event2 = event2;
		this.vehicleId = vehicleId;
		this.companyId = companyId;
		this.type = type;
		this.previousEventIdx = idx;
	}
	type: string;
	previousEventIdx: number;
	event1: Event | undefined;
	event2: Event | undefined;
	vehicleId: number;
	companyId: number;
}

export class TourScheduler {
	constructor(startFixed: boolean, one: Coordinates) {
		this.eventInsertionIdx = 0;
		this.singleEventInsertions = [];
		this.possible = [];
		this.newTours = [];
		this.startMany = [];
		this.targetMany = [];
		this.possibleInsertionsByVehicle = new Map<number, Range[]>();
		this.startFixed = startFixed;
		this.one = one;
	}
	startFixed: boolean;
	one: Coordinates;
	singleEventInsertions: EventInsertion[];
	possible: boolean[][];
	eventInsertionIdx: number;
	newTours: NewTour[];
	startMany: Coordinates[];
	targetMany: Coordinates[];
	possibleInsertionsByVehicle: Map<number, Range[]>;

	cmpFullTravelDurations = (
		durationStart: number[],
		durationsTargets: number[][],
		travelDurations: number[]
	) => {
		this.newTours.forEach((tc) => {
			tc.fullTravelDuration =
				durationStart[tc.oneRoutingResultIdx!] +
				durationsTargets[tc.toIdx][tc.manyRoutingResultIdx!] +
				travelDurations[tc.toIdx];
		});
	};

	createTourConcatenations = (
		companies: Company[],
		requiredCapacity: Capacity,
		many: SimpleEvent[]
	) => {
		this.newTours.concat(companies.map((c) => new NewTour(c.id, 1, c.coordinates)));
		forEachVehicle(companies, (c, v) => {
			const simulation = new CapacitySimulation(
				v.bike_capacity,
				v.wheelchair_capacity,
				v.seats,
				v.storage_space
			);
			const allEvents = v.tours.flatMap((t) => t.events);
			const insertions = simulation.getPossibleInsertionRanges(allEvents, requiredCapacity);
			this.possibleInsertionsByVehicle.set(v.id, insertions);
			forEachInsertion(insertions, (insertionIdx) => {
				const prevEvent = allEvents[insertionIdx];
				const nextEvent = allEvents[insertionIdx + 1];
				const insertionCandidate = new EventInsertion(
					prevEvent,
					nextEvent,
					c.id,
					v.id,
					'',
					insertionIdx
				);
				this.addEventInsertion(insertionCandidate, many);
			});
		});
	};

	private addEventInsertion(insertion: EventInsertion, many: SimpleEvent[]) {
		const possible = new Array<boolean>(many.length);
		many.forEach((se, idx) => {
			possible[idx] = beelineCheck(insertion, se);
		});
		if (!possible.some((b) => b)) {
			return;
		}
		this.possible.push(possible);
		this.singleEventInsertions.push(insertion);
	}

	addCoordinates() {
		this.newTours.forEach((t) => {
			this.addTc(true, t, this.startMany);
			this.addTc(false, t, this.targetMany);
		});
	}

	private addTc(start: boolean, tourConcatenation: TCC, many: Coordinates[]) {
		const position: number | undefined = many.findIndex(
			(coordinates) => coordinates.lat == coordinates.lat && coordinates.lng == coordinates.lng
		);
		let routingResultIdx: number | undefined = undefined;
		if (position == undefined) {
			routingResultIdx = many.length;
			many.push(
				start ? tourConcatenation.getStartCoordinates() : tourConcatenation.getTargetCoordinates()
			);
		} else {
			routingResultIdx = position;
		}
		if (start) {
			tourConcatenation.oneRoutingResultIdx = routingResultIdx;
		} else {
			tourConcatenation.manyRoutingResultIdx = routingResultIdx;
		}
	}
}

function forEachInsertion<T>(insertions: Range[], fn: (insertionIdx: number) => T) {
	insertions.forEach((insertion) => {
		for (let i = insertion.earliestPickup; i != insertion.latestDropoff; ++i) {
			fn(i);
		}
	});
}

function beelineCheck(insertion: EventInsertion, se: SimpleEvent): boolean {
	return true; //TODO
}
