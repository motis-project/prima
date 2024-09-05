import { Interval } from '$lib/interval.js';
import { Coordinates } from '$lib/location.js';
import { minutesToMs } from '$lib/time_utils.js';
import { Capacity, CapacitySimulation, type Range } from '$lib/capacities.js';
import { type Company, type Event } from '$lib/compositionTypes.js';
import type { SimpleEvent } from './+server.js';
import { Direction, oneToMany } from '$lib/api.js';

enum InsertionType {
	CONNECT,
	APPEND,
	PREPEND,
	INSERT
}

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
				.filter((a) => a.getDurationMs() >= this.fullTravelDuration!)
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

class EventInsertion {
	constructor(
		startFixed: boolean,
		fromUserChosenDuration: number,
		toUserChosenDuration: number,
		fromBusStopDurations: number[],
		toBusStopDurations: number[],
		travelDurations: number[]
	) {
		console.assert(fromBusStopDurations.length == toBusStopDurations.length);
		console.assert(fromBusStopDurations.length == travelDurations.length);
		this.userChosenDuration = fromUserChosenDuration + toUserChosenDuration;
		this.busStopDurations = new Array<number>(fromBusStopDurations.length);
		this.bothDurations = new Array<number>(fromBusStopDurations.length);
		for (let i = 0; i != fromBusStopDurations.length; ++i) {
			this.busStopDurations[i] = fromBusStopDurations[i] + toBusStopDurations[i];
			this.bothDurations[i] =
				(startFixed ? fromBusStopDurations[i] : fromUserChosenDuration) +
				travelDurations[i] +
				(startFixed ? toUserChosenDuration : toBusStopDurations[i]);
		}
	}
	userChosenDuration: number;
	busStopDurations: number[];
	bothDurations: number[];
}

type Answer = {
	companyId: number;
	vehicleId: number;
	pickupAfterEventId: number | undefined;
	dropoffAfterEventId: number | undefined;
	type: InsertionType;
};

export class TourScheduler {
	constructor(
		startFixed: boolean,
		userChosen: Coordinates,
		busStops: Coordinates[],
		timestamps: Date[][],
		travelDurations: number[],
		companies: Company[],
		required: Capacity
	) {
		this.timestamps = timestamps;
		this.required = required;
		this.companies = companies;
		this.travelDurations = travelDurations;
		this.insertDurations = new Array<EventInsertion[][]>(companies.length);
		this.appendDurations = new Array<EventInsertion[][]>(companies.length);
		this.prependDurations = new Array<EventInsertion[][]>(companies.length);
		this.connectDurations = new Array<EventInsertion[][]>(companies.length);
		this.possibleInsertionsByVehicle = new Map<number, Range[]>();
		this.startFixed = startFixed;
		this.userChosen = userChosen;
		this.userChosenFromMany = [];
		this.userChosenToMany = [];
		this.busStops = busStops;
		this.busStopFromMany = new Array<Coordinates[]>(busStops.length);
		this.busStopToMany = new Array<Coordinates[]>(busStops.length);
		this.userChosenToDuration = [];
		this.userChosenFromDuration = [];
		this.busStopToDurations = new Array<number[]>(busStops.length);
		this.busStopFromDurations = new Array<number[]>(busStops.length);
		this.answers = new Array<Answer[]>(busStops.length);
	}
	timestamps: Date[][];
	required: Capacity;
	companies: Company[];
	startFixed: boolean;
	travelDurations: number[];
	userChosen: Coordinates;
	busStops: Coordinates[];

	userChosenFromMany: Coordinates[];
	userChosenToMany: Coordinates[];
	busStopFromMany: Coordinates[][];
	busStopToMany: Coordinates[][];

	userChosenToDuration: number[];
	userChosenFromDuration: number[];
	busStopToDurations: number[][];
	busStopFromDurations: number[][];

	insertDurations: EventInsertion[][][];
	appendDurations: EventInsertion[][][];
	prependDurations: EventInsertion[][][];
	connectDurations: EventInsertion[][][];

	possibleInsertionsByVehicle: Map<number, Range[]>;
	answers: Answer[][];

	createTourConcatenations = async () => {
		//this.newTours.concat(companies.map((c) => new NewTour(c.id, 1, c.coordinates)));
		this.simulateCapacities();
		this.gatherRoutingCoordinates();
		this.routing();
		this.computeTravelDurations();
		this.createInsertionPairs();
	};

	private simulateCapacities() {
		this.companies.forEach((c) => {
			c.vehicles.forEach((v) => {
				const allEvents = v.tours.flatMap((t) => t.events);
				const simulation = new CapacitySimulation(
					v.bike_capacity,
					v.wheelchair_capacity,
					v.seats,
					v.storage_space
				);
				const insertions = simulation.getPossibleInsertionRanges(allEvents, this.required);
				this.possibleInsertionsByVehicle.set(v.id, insertions);
			});
		});
	}

	private gatherRoutingCoordinates() {
		this.companies.forEach((c) => {
			for (let busStopIdx = 0; busStopIdx != this.busStops.length; ++busStopIdx) {
				this.busStopFromMany[busStopIdx].push(c.coordinates);
				this.busStopToMany[busStopIdx].push(c.coordinates);
			}
			this.userChosenFromMany.push(c.coordinates);
			this.userChosenToMany.push(c.coordinates);
			c.vehicles.forEach((v) => {
				const allEvents = v.tours.flatMap((t) => t.events);
				const insertions = this.possibleInsertionsByVehicle.get(v.id)!;
				forEachInsertion(insertions, (insertionIdx) => {
					const prev = allEvents[insertionIdx].coordinates;
					const next = allEvents[insertionIdx + 1].coordinates;
					for (let busStopIdx = 0; busStopIdx != this.busStops.length; ++busStopIdx) {
						this.busStopFromMany[busStopIdx].push(prev);
						this.busStopToMany[busStopIdx].push(next);
					}
					this.userChosenFromMany.push(prev);
					this.userChosenToMany.push(next);
				});
			});
		});
	}

	private async routing() {
		this.userChosenFromDuration = (
			await oneToMany(this.userChosen, this.userChosenFromMany, Direction.Backward)
		).map((r) => r.duration);
		this.userChosenToDuration = (
			await oneToMany(this.userChosen, this.userChosenToMany, Direction.Forward)
		).map((r) => r.duration);
		for (let busStopIdx = 0; busStopIdx != this.busStops.length; ++busStopIdx) {
			this.busStopFromDurations[busStopIdx] = (
				await oneToMany(
					this.busStops[busStopIdx],
					this.busStopFromMany[busStopIdx],
					Direction.Backward
				)
			).map((r) => r.duration);
			this.busStopToDurations[busStopIdx] = (
				await oneToMany(
					this.busStops[busStopIdx],
					this.busStopToMany[busStopIdx],
					Direction.Forward
				)
			).map((r) => r.duration);
		}
	}

	private computeTravelDurations() {
		this.companies.forEach((c, companyIdx) => {
			this.insertDurations[companyIdx] = new Array<EventInsertion[]>(c.vehicles.length);
			this.appendDurations[companyIdx] = new Array<EventInsertion[]>(c.vehicles.length);
			this.prependDurations[companyIdx] = new Array<EventInsertion[]>(c.vehicles.length);
			this.connectDurations[companyIdx] = new Array<EventInsertion[]>(c.vehicles.length);
			c.vehicles.forEach((v, vehicleIdx) => {
				const allEvents = v.tours.flatMap((t) => t.events);
				const insertions = this.possibleInsertionsByVehicle.get(v.id)!;
				if (insertions.length == 0) {
					return;
				}
				const lastInsertionIdx = insertions[insertions.length - 1].latestDropoff;
				this.insertDurations[companyIdx][vehicleIdx] = new Array<EventInsertion>(lastInsertionIdx);
				this.appendDurations[companyIdx][vehicleIdx] = new Array<EventInsertion>(lastInsertionIdx);
				this.prependDurations[companyIdx][vehicleIdx] = new Array<EventInsertion>(lastInsertionIdx);
				this.connectDurations[companyIdx][vehicleIdx] = new Array<EventInsertion>(lastInsertionIdx);
				forEachInsertion(insertions, (insertionIdx) => {
					const prev = allEvents[insertionIdx];
					const next = allEvents[insertionIdx + 1];
					if (prev.tourId == next.tourId) {
						this.insertDurations[companyIdx][vehicleIdx][insertionIdx] = new EventInsertion(
							this.startFixed,
							this.userChosenFromDuration[insertionIdx],
							this.userChosenToDuration[insertionIdx],
							this.busStopFromDurations[insertionIdx],
							this.busStopToDurations[insertionIdx],
							this.travelDurations
						);
					} else {
						this.appendDurations[companyIdx][vehicleIdx][insertionIdx] = new EventInsertion(
							this.startFixed,
							this.userChosenFromDuration[insertionIdx],
							this.userChosenToDuration[companyIdx],
							this.busStopFromDurations[insertionIdx],
							this.busStopToDurations[companyIdx],
							this.travelDurations
						);
						this.prependDurations[companyIdx][vehicleIdx][insertionIdx] = new EventInsertion(
							this.startFixed,
							this.userChosenFromDuration[companyIdx],
							this.userChosenToDuration[insertionIdx],
							this.busStopFromDurations[companyIdx],
							this.busStopToDurations[insertionIdx],
							this.travelDurations
						);
						this.connectDurations[companyIdx][vehicleIdx][insertionIdx] = new EventInsertion(
							this.startFixed,
							this.userChosenFromDuration[companyIdx],
							this.userChosenToDuration[companyIdx],
							this.busStopFromDurations[companyIdx],
							this.busStopToDurations[companyIdx],
							this.travelDurations
						);
					}
				});
			});
		});
	}

	private createInsertionPairs() {
		this.companies.forEach((c, companyIdx) => {
			c.vehicles.forEach((v, vehicleIdx) => {
				const insertions = this.possibleInsertionsByVehicle.get(v.id)!;
				const allEvents = v.tours.flatMap((t) => t.events);
				insertions.forEach((insertion) => {
					for (
						let pickupIdx = insertion.earliestPickup;
						pickupIdx != insertion.latestDropoff;
						++pickupIdx
					) {
						for (let dropoffIdx = pickupIdx; dropoffIdx != insertion.latestDropoff; ++dropoffIdx) {
							if (allEvents[pickupIdx + 1].tourId != allEvents[dropoffIdx].tourId) {
								break;
							}
							this.createInsertionPair(
								allEvents,
								pickupIdx,
								dropoffIdx,
								companyIdx,
								c.id,
								vehicleIdx,
								v.id
							);
						}
					}
				});
			});
		});
	}

	private createInsertionPair(
		allEvents: Event[],
		pickupIdx: number,
		dropoffIdx: number,
		companyIdx: number,
		companyId: number,
		vehicleIdx: number,
		vehicleId: number
	) {
		const prevPickup = allEvents[pickupIdx];
		const nextPickup = allEvents[pickupIdx + 1];
		const prevDropoff = allEvents[dropoffIdx];
		const nextDropoff = allEvents[dropoffIdx + 1];
		const eventTimeDifference =
			nextPickup.time.startTime.getTime() - prevPickup.time.endTime.getTime();
		this.busStops.forEach((_, busStopIdx) => {
			let duration: number | undefined = undefined;
			let connectDuration: number | undefined = undefined;
			let appendDuration: number | undefined = undefined;
			let prependDuration: number | undefined = undefined;
			if (pickupIdx == dropoffIdx) {
				if (prevPickup.tourId != nextPickup.tourId) {
					connectDuration =
						this.connectDurations[companyIdx][vehicleIdx][pickupIdx].bothDurations[busStopIdx];
					appendDuration =
						this.appendDurations[companyIdx][vehicleIdx][pickupIdx].bothDurations[busStopIdx];
					prependDuration =
						this.prependDurations[companyIdx][vehicleIdx][pickupIdx].bothDurations[busStopIdx];
				} else {
					duration =
						this.insertDurations[companyIdx][vehicleIdx][pickupIdx].bothDurations[busStopIdx];
				}
			} else {
				if (prevPickup.tourId != nextPickup.tourId) {
				} else {
					const busStopDuration =
						this.insertDurations[companyIdx][vehicleIdx][this.startFixed ? pickupIdx : dropoffIdx]
							.busStopDurations[busStopIdx];
					const userChosenDuration =
						this.insertDurations[companyIdx][vehicleIdx][this.startFixed ? dropoffIdx : pickupIdx]
							.userChosenDuration;
					duration = userChosenDuration + busStopDuration;
				}
			}

			if (duration != undefined && duration <= eventTimeDifference) {
				this.answers[busStopIdx].push({
					companyId,
					vehicleId,
					pickupAfterEventId: prevPickup.id,
					dropoffAfterEventId: prevDropoff.id,
					type: InsertionType.INSERT
				});
			}
			if (connectDuration != undefined && connectDuration <= eventTimeDifference) {
				this.answers[busStopIdx].push({
					companyId,
					vehicleId,
					pickupAfterEventId: prevPickup.id,
					dropoffAfterEventId: prevDropoff.id,
					type: InsertionType.CONNECT
				});
			}
			if (appendDuration != undefined && appendDuration <= eventTimeDifference) {
				this.answers[busStopIdx].push({
					companyId,
					vehicleId,
					pickupAfterEventId: prevPickup.id,
					dropoffAfterEventId: prevDropoff.id,
					type: InsertionType.APPEND
				});
			}
			if (prependDuration != undefined && prependDuration <= eventTimeDifference) {
				this.answers[busStopIdx].push({
					companyId,
					vehicleId,
					pickupAfterEventId: prevPickup.id,
					dropoffAfterEventId: prevDropoff.id,
					type: InsertionType.PREPEND
				});
			}
		});
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
