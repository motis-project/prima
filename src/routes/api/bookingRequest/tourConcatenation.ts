import { Interval } from '$lib/interval.js';
import { Coordinates } from '$lib/location.js';
import { minutesToMs } from '$lib/time_utils.js';
import { Capacity, CapacitySimulation, type Range } from './capacities.js';
import { forEachVehicle } from './queries.js';
import { type Company, type Event } from '$lib/compositionTypes.js';
import { getOrCreate } from '$lib/collection_utils.js';

export const addTourConcatCoordinates = (
	tourConcatenation: TourConcatenation,
	startMany: Coordinates[],
	targetMany: Coordinates[]
) => {
	const addTc = (
		start: boolean,
		tourConcatenation: TourConcatenation,
		many: Coordinates[],
		coordinates: Coordinates
	) => {
		const position: number | undefined = many.findIndex(
			(coordinates) => coordinates.lat == coordinates.lat && coordinates.lng == coordinates.lng
		);
		let routingResultIdx: number | undefined = undefined;
		if (position == undefined) {
			routingResultIdx = many.length;
			many.push(start ? coordinates : coordinates);
		} else {
			routingResultIdx = position;
		}
		if (start) {
			tourConcatenation.oneRoutingResultIdx = routingResultIdx;
		} else {
			tourConcatenation.manyRoutingResultIdx = routingResultIdx;
		}
	};
	addTc(true, tourConcatenation, startMany, tourConcatenation.getStartCoordinates());
	addTc(false, tourConcatenation, targetMany, tourConcatenation.getTargetCoordinates());
};

type StartTimesWithDuration = {
	possibleStartTimes: Interval[];
	duration: number;
};

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

class NewTour extends TourConcatenation {
	constructor(companyId: number, toIdx: number, coordinates: Coordinates) {
		super(companyId, toIdx);
		this.coordinates = coordinates;
	}
	coordinates: Coordinates;
	getStartCoordinates = (): Coordinates => {
		return this.coordinates;
	};
	getTargetCoordinates = (): Coordinates => {
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

export class TourConcatenations {
	constructor() {
		this.concatenations = [];
		this.startMany = [];
		this.targetMany = [];
		this.possibleInsertionsByVehicle = new Map<number, Range[]>();
	}
	concatenations: TourConcatenation[];
	startMany: Coordinates[];
	targetMany: Coordinates[];
	possibleInsertionsByVehicle: Map<number, Range[]>;

	cmpFullTravelDurations = (
		durationStart: number[],
		durationsTargets: number[][],
		travelDurations: number[]
	) => {
		this.concatenations.forEach((tc) => {
			tc.fullTravelDuration =
				durationStart[tc.oneRoutingResultIdx!] +
				durationsTargets[tc.toIdx][tc.manyRoutingResultIdx!] +
				travelDurations[tc.toIdx];
		});
	};

	createTourConcatenations = (companies: Company[], requiredCapacity: Capacity) => {
		this.concatenations.concat(companies.map((c) => new NewTour(c.id, 1, c.coordinates)));
		forEachVehicle(companies, (c, v) => {
			const simulation = new CapacitySimulation(
				v.bike_capacity,
				v.wheelchair_capacity,
				v.seats,
				v.storage_space
			);
			const allEvents = v.tours.flatMap((t) => t.events);
			const insertions = getOrCreate(this.possibleInsertionsByVehicle, v.id, (_) =>
				simulation.getPossibleInsertionRanges(
					allEvents,
					requiredCapacity
				)
			);
			const s: BetweenEvents[] = [];
			insertions.forEach((insertionRange) => {
				for (let i = insertionRange.earliestPickup; i != insertionRange.latestDropoff; ++i) {
					const prevEvent = allEvents[i];
					const nextEvent = allEvents[i+1];
					s.push(new BetweenEvents(prevEvent, nextEvent, c.id));
				}
			});
		});
	};

	addCoordinates() {
		this.concatenations.forEach((t) => {
			addTourConcatCoordinates(t, this.startMany, this.targetMany);
		});
	}
}
