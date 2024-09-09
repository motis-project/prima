import { Interval } from '$lib/interval.js';
import { Coordinates } from '$lib/location.js';
import { Capacity, CapacitySimulation, type Range } from '$lib/capacities.js';
import { type Company, type Event } from '$lib/compositionTypes.js';
import type { SimpleEvent } from './+server.js';
import { Direction, oneToMany } from '$lib/api.js';
import { MAX_PASSENGER_WAITING_TIME } from '$lib/constants.js';

enum InsertionType {
	CONNECT,
	APPEND,
	PREPEND,
	INSERT
}

enum Timing {
	BEFORE,
	AFTER
}

class EventInsertion {
	constructor(
		startFixed: boolean,
		fromUserChosenDuration: number,
		toUserChosenDuration: number,
		fromBusStopDurations: number[],
		toBusStopDurations: number[],
		travelDurations: number[],
		window: Interval,
		busStopTimes: Interval[][],
		availabilities: Interval[],
		type: InsertionType
	) {
		console.assert(fromBusStopDurations.length == toBusStopDurations.length);
		console.assert(fromBusStopDurations.length == travelDurations.length);
		this.busStops = new Array<Interval[][]>(busStopTimes.length);
		this.both=new Array<Interval[][]>(busStopTimes.length);

		const availabilitiesInWindow: Interval[] = type!=InsertionType.INSERT?[window]:Interval.intersect(availabilities, window);
		
		this.userChosen=availabilitiesInWindow.filter((a)=>a.getDurationMs()>=fromUserChosenDuration + toUserChosenDuration!);
		for(let i=0;i!=travelDurations.length;++i){
			const duration = fromBusStopDurations[i] + toBusStopDurations[i];
			const bothDuration = (startFixed ? fromBusStopDurations[i] : fromUserChosenDuration) +
			travelDurations[i] +
			(startFixed ? toUserChosenDuration : toBusStopDurations[i]);
			for(let j=0;j!=busStopTimes[i].length;++j){
				this.busStops[i][j] = Interval.intersect(availabilitiesInWindow.filter((a)=>a.getDurationMs()>=duration), busStopTimes[i][j]);
				this.both[i][j] = Interval.intersect(availabilitiesInWindow.filter((a)=>a.getDurationMs()>=bothDuration), busStopTimes[i][j]);
			}
		}
	}
	userChosen:Interval[];
	busStops:Interval[][][];
	both:Interval[][][];
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
		busStopTimes: Date[][],
		travelDurations: number[],
		companies: Company[],
		required: Capacity,
		companyMayServeBusStop:boolean[][]
	) {
		this.companyMayServeBusStop = companyMayServeBusStop;
		this.busStopTimes = busStopTimes.map((times)=>times.map((t)=>new Interval(startFixed?t:new Date(t.getTime()-MAX_PASSENGER_WAITING_TIME), startFixed?new Date(t.getTime()+MAX_PASSENGER_WAITING_TIME):t)));
		this.required = required;
		this.companies = companies;
		this.travelDurations = travelDurations;
		this.startFixed = startFixed;
		this.userChosen = userChosen;
		this.busStops = busStops;
		
		this.possibleInsertionsByVehicle = new Map<number, Range[]>();

		this.userChosenMany = new Array<Coordinates[]>(2);
		this.busStopMany = new Array<Coordinates[][]>(2);

		this.userChosenDuration = new Array<number[]>(2);
		this.busStopDurations = new Array<number[][]>(2);

		this.insertDurations = new Array<EventInsertion[][][]>(companies.length);

		this.insertionIndexesUserChosenDurationIndexes=[];
		this.insertionIndexesBusStopDurationIndexes=[];

		this.companyIndexesUserChosenDurationIndexes=new Array<number[]>(companies.length);
		this.companyIndexesBusStopDurationIndexes=new Array<number[][]>(companies.length);

		this.answers = new Array<Answer[]>(busStops.length);
	}
	companyMayServeBusStop: boolean[][];
	busStopTimes: Interval[][];
	required: Capacity;
	companies: Company[];
	startFixed: boolean;
	travelDurations: number[];
	userChosen: Coordinates;
	busStops: Coordinates[];
	
	possibleInsertionsByVehicle: Map<number, Range[]>;

	userChosenMany: Coordinates[][];
	busStopMany: Coordinates[][][];

	userChosenDuration: number[][];
	busStopDurations: number[][][];

	insertionIndexesUserChosenDurationIndexes: number[][][][];
	insertionIndexesBusStopDurationIndexes: number[][][][][];

	companyIndexesUserChosenDurationIndexes: number[][];
	companyIndexesBusStopDurationIndexes: number[][][];

	insertDurations: EventInsertion[][][][];

	answers: Answer[][];

	createTourConcatenations = async () => {
		this.simulateCapacities();
		this.gatherRoutingCoordinates();
		this.routing();
		this.computeTravelDurations();
		this.createInsertionPairs();
	};

	private simulateCapacities() {
		this.companies.forEach((c) => {
			c.vehicles.forEach((v) => {
				const simulation = new CapacitySimulation(
					v.bike_capacity,
					v.wheelchair_capacity,
					v.seats,
					v.storage_space
				);
				this.possibleInsertionsByVehicle.set(v.id, simulation.getPossibleInsertionRanges(v.tours.flatMap((t) => t.events), this.required));
			});
		});
	}

	private gatherRoutingCoordinates() {
		this.companies.forEach((c, companyIdx) => {
			this.addCompanyCoordinates(c.coordinates, companyIdx);
			c.vehicles.forEach((v, vehicleIdx) => {
				const allEvents = v.tours.flatMap((t) => t.events);
				const insertions = this.possibleInsertionsByVehicle.get(v.id)!;
				forEachInsertion(insertions, (insertionIdx) => {
					this.addCoordinates(allEvents[insertionIdx].coordinates, allEvents[insertionIdx + 1].coordinates, companyIdx, vehicleIdx, insertionIdx);
				});
			});
		});
	}

	private addCompanyCoordinates(c: Coordinates, companyIdx: number){
		for (let busStopIdx = 0; busStopIdx != this.busStops.length; ++busStopIdx) {
			if(!this.companyMayServeBusStop[busStopIdx][companyIdx]){
				continue;
			}
			this.busStopMany[Timing.BEFORE][busStopIdx].push(c);
			this.companyIndexesBusStopDurationIndexes[Timing.BEFORE][companyIdx][busStopIdx] = this.busStopMany.length;
			this.busStopMany[Timing.AFTER][busStopIdx].push(c);
			this.companyIndexesBusStopDurationIndexes[Timing.AFTER][companyIdx][busStopIdx] = this.busStopMany.length;
		}
		this.userChosenMany[Timing.BEFORE].push(c);
		this.userChosenMany[Timing.AFTER].push(c);
	}

	private addCoordinates(prev: Coordinates, next: Coordinates, companyIdx: number, vehicleIdx: number, insertionIdx: number) {
		for (let busStopIdx = 0; busStopIdx != this.busStops.length; ++busStopIdx) {
			if(!this.companyMayServeBusStop[busStopIdx][companyIdx]){
				continue;
			}
			this.busStopMany[Timing.BEFORE][busStopIdx].push(prev);
			this.insertionIndexesBusStopDurationIndexes[Timing.BEFORE][companyIdx][vehicleIdx][insertionIdx][busStopIdx] = this.busStopMany[busStopIdx].length;
			this.busStopMany[Timing.AFTER][busStopIdx].push(next);
			this.insertionIndexesBusStopDurationIndexes[Timing.AFTER][companyIdx][vehicleIdx][insertionIdx][busStopIdx] = this.busStopMany[busStopIdx].length;
		}
		this.userChosenMany[Timing.BEFORE].push(prev);
		this.insertionIndexesUserChosenDurationIndexes[Timing.BEFORE][companyIdx][vehicleIdx][insertionIdx] = this.busStopMany.length;
		this.userChosenMany[Timing.AFTER].push(next);
		this.insertionIndexesUserChosenDurationIndexes[Timing.AFTER][companyIdx][vehicleIdx][insertionIdx] = this.busStopMany.length;
	}

	private async routing() {
		this.userChosenDuration[Timing.BEFORE] = (
			await oneToMany(this.userChosen, this.userChosenMany[Timing.BEFORE], Direction.Backward)
		).map((r) => r.duration);
		this.userChosenDuration[Timing.AFTER] = (
			await oneToMany(this.userChosen, this.userChosenMany[Timing.AFTER], Direction.Forward)
		).map((r) => r.duration);
		for (let busStopIdx = 0; busStopIdx != this.busStops.length; ++busStopIdx) {
			this.busStopDurations[Timing.BEFORE][busStopIdx] = (
				await oneToMany(
					this.busStops[busStopIdx],
					this.busStopMany[Timing.BEFORE][busStopIdx],
					Direction.Backward
				)
			).map((r) => r.duration);
			this.busStopDurations[Timing.AFTER][busStopIdx] = (
				await oneToMany(
					this.busStops[busStopIdx],
					this.busStopMany[Timing.AFTER][busStopIdx],
					Direction.Forward
				)
			).map((r) => r.duration);
		}
	}

	private computeTravelDurations() {
		const cases = [InsertionType.CONNECT, InsertionType.APPEND, InsertionType.PREPEND, InsertionType.INSERT];
		this.companies.forEach((c, companyIdx) => {
			this.insertDurations[companyIdx] = new Array<EventInsertion[][]>(c.vehicles.length);
			c.vehicles.forEach((v, vehicleIdx) => {
				const allEvents = v.tours.flatMap((t) => t.events);
				const insertions = this.possibleInsertionsByVehicle.get(v.id)!;
				if (insertions.length == 0) {
					return;
				}
				const lastInsertionIdx = insertions[insertions.length - 1].latestDropoff;
				this.insertDurations[companyIdx][vehicleIdx] = new Array<EventInsertion[]>(lastInsertionIdx);
				forEachInsertion(insertions, (insertionIdx) => {
					this.insertDurations[companyIdx][vehicleIdx][insertionIdx] = new Array<EventInsertion>(4);
					const prev = allEvents[insertionIdx];
					const next = allEvents[insertionIdx + 1];
					const departure = v.tours.find((t) => t.id == next.tourId)!.departure;
					const arrival = v.tours.find((t) => t.id == prev.tourId)!.arrival;
					cases.forEach((type) => {
						if((prev.tourId == next.tourId) != (type == InsertionType.INSERT)){
							return;
						}
						const isAppend = type === InsertionType.CONNECT || type === InsertionType.APPEND;
						const isPrepend = type === InsertionType.CONNECT || type === InsertionType.PREPEND;
						const interv = new Interval(isAppend?arrival:prev.time.startTime, isPrepend?departure:next.time.endTime);
						const p = isAppend?companyIdx: insertionIdx;
						const n = isPrepend?companyIdx: insertionIdx;
						this.insertDurations[companyIdx][vehicleIdx][insertionIdx][type] = new EventInsertion(
							this.startFixed,
							this.userChosenDuration[Timing.BEFORE][p],
							this.userChosenDuration[Timing.AFTER][n],
							this.busStopDurations[Timing.BEFORE][p],
							this.busStopDurations[Timing.AFTER][n],
							this.travelDurations,
							interv,
							this.busStopTimes,
							v.availabilities,
							type
						);
					});
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
							const prevPickup = allEvents[pickupIdx];
							const nextPickup = allEvents[pickupIdx + 1];
							const prevDropoff = allEvents[dropoffIdx];
							const nextDropoff = allEvents[dropoffIdx + 1];
							const pickupTimeDifference =
								nextPickup.time.startTime.getTime() - prevPickup.time.endTime.getTime();
							if (nextPickup.tourId != prevDropoff.tourId) {
								break;
							}
							if(prevPickup.tourId == nextDropoff.tourId) {
								if(prevPickup.id == prevDropoff.id) {
									this.busStops.forEach((_, busStopIdx) => {
										const duration =
											this.insertDurations[InsertionType.INSERT][companyIdx][vehicleIdx][pickupIdx].bothDurations[busStopIdx];		
										if (duration != undefined && duration <= pickupTimeDifference) {
											this.answers[busStopIdx].push({
												companyId: c.id,
												vehicleId: v.id,
												pickupAfterEventId: prevPickup.id,
												dropoffAfterEventId: prevDropoff.id,
												type: InsertionType.INSERT
											});
										}
									});
								}
								else{

								}
								continue;
							}
							if(prevPickup.tourId == nextPickup.tourId) {

								continue;
							}
							if(prevDropoff.tourId == nextDropoff.tourId) {

								continue;
							}

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
						this.insertDurations[InsertionType.CONNECT][companyIdx][vehicleIdx][pickupIdx].bothDurations[busStopIdx];
					appendDuration =
						this.insertDurations[InsertionType.APPEND][companyIdx][vehicleIdx][pickupIdx].bothDurations[busStopIdx];
					prependDuration =
						this.insertDurations[InsertionType.PREPEND][companyIdx][vehicleIdx][pickupIdx].bothDurations[busStopIdx];
				} else {
					duration =
						this.insertDurations[InsertionType.INSERT][companyIdx][vehicleIdx][pickupIdx].bothDurations[busStopIdx];
				}
			} else {
				if (prevPickup.tourId != nextPickup.tourId) {
				} else {
					const busStopDuration =
						this.insertDurations[InsertionType.INSERT][companyIdx][vehicleIdx][this.startFixed ? pickupIdx : dropoffIdx]
							.busStopDurations[busStopIdx];
					const userChosenDuration =
						this.insertDurations[InsertionType.INSERT][companyIdx][vehicleIdx][this.startFixed ? dropoffIdx : pickupIdx]
							.userChosenDuration;
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
