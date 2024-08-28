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
		this.fullTravelDurations = [];
	}
	abstract getStartCoordinates(): Coordinates;
	abstract getTargetCoordinates(): Coordinates;
	abstract cmpFullTravelDurations(
		durationStart: number[],
		durationsTargets: number[][],
		travelDurations: number[]
	): void;
	oneRoutingResultIdx: number | undefined;
	manyRoutingResultIdx: number | undefined;
	fullTravelDurations: number[][];
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
	}
	getTargetCoordinates(): Coordinates {
		return this.coordinates;
	}
	cmpFullTravelDurations(
		durationStart: number[],
		durationsTargets: number[][],
		travelDurations: number[]
	): void {
		this.fullTravelDurations.forEach((fullTravelDurations, targetIdx) => {
			fullTravelDurations[targetIdx] =
				durationStart[this.oneRoutingResultIdx!] +
				durationsTargets[targetIdx][this.manyRoutingResultIdx!] +
				travelDurations[targetIdx];
		});
	}
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
		idx: number
	) {
		this.event1 = event1;
		this.event2 = event2;
		this.vehicleId = vehicleId;
		this.companyId = companyId;
		this.previousEventIdx = idx;
	}
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
		this.approachIdxs = [];
		this.returnIdxs = [];
		this.approachFromCompanyHome = [];
		this.returnFromCompanyHome = [];
		this.possible = [];
		this.newTours = [];
		this.approachMany = [];
		this.returnMany = [];
		this.possibleInsertionsByVehicle = new Map<number, Range[]>();
		this.startFixed = startFixed;
		this.userChosen = one;
	}
	startFixed: boolean;
	userChosen: Coordinates;
	singleEventInsertions: EventInsertion[];
	approachIdxs: number[];
	returnIdxs: number[];
	approachFromCompanyHome: number[];
	returnFromCompanyHome: number[];
	possible: boolean[][];
	eventInsertionIdx: number;
	newTours: NewTour[];
	approachMany: Coordinates[];
	returnMany: Coordinates[];
	possibleInsertionsByVehicle: Map<number, Range[]>;

	createTourConcatenations = (
		companies: Company[],
		requiredCapacity: Capacity,
		busStops: SimpleEvent[]
	) => {
		this.newTours.concat(companies.map((c) => new NewTour(c.id, 1, c.coordinates)));
		companies.forEach((c) => {
			const companyApproachIdx = this.addRoutingRequest(c.coordinates, this.approachMany);
			const companyReturnIdx = this.addRoutingRequest(c.coordinates, this.returnMany);
			c.vehicles.forEach((v) => {
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
						insertionIdx
					);
					this.addEventInsertion(
						insertionCandidate,
						busStops,
						this.addRoutingRequest(prevEvent.coordinates, this.approachMany),
						this.addRoutingRequest(nextEvent.coordinates, this.returnMany)
					);
				});
			});
		});
	};

	private addTc(
		pickup: boolean,
		coordinates: Coordinates,
		tourConcatenation: TCC,
		many: Coordinates[]
	) {
		let routingResultIdx: number | undefined = many.findIndex(
			(c) => c.lat == coordinates.lat && c.lng == coordinates.lng
		);
		if (routingResultIdx == undefined) {
			routingResultIdx = many.length;
			many.push(coordinates);
		}
		if (pickup) {
			tourConcatenation.oneRoutingResultIdx = routingResultIdx;
		} else {
			tourConcatenation.manyRoutingResultIdx = routingResultIdx;
		}
	}

	private addRoutingRequest(c: Coordinates, many: Coordinates[]): number {
		let routingResultIdx: number | undefined = many.findIndex(
			(coordinates) => c.lat == coordinates.lat && c.lng == coordinates.lng
		);
		if (routingResultIdx == undefined) {
			routingResultIdx = many.length;
			many.push(c);
		}
		return routingResultIdx;
	}

	private addEventInsertion(
		insertion: EventInsertion,
		many: SimpleEvent[],
		approachIdx: number,
		returnIdx: number
	) {
		const possible = new Array<boolean>(many.length);
		many.forEach((se, idx) => {
			possible[idx] = beelineCheck(insertion, se);
		});
		if (!possible.some((b) => b)) {
			return;
		}
		this.possible.push(possible);
		this.singleEventInsertions.push(insertion);
		this.approachIdxs.push(approachIdx);
		this.returnIdxs.push(returnIdx);
	}

	addCoordinates() {
		this.newTours.forEach((t) => {
			this.addTc(true, t.getStartCoordinates(), t, this.approachMany);
			this.addTc(false, t.getStartCoordinates(), t, this.returnMany);
		});
	}

	cmpFullTravelDurations = (
		durationStart: number[],
		durationsTargets: number[][],
		travelDurations: number[]
	) => {
		this.newTours.forEach((tc) => {
			tc.cmpFullTravelDurations(durationStart, durationsTargets, travelDurations);
		});
	};
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
