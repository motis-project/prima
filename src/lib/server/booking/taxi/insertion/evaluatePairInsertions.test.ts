import { MINUTE } from '$lib/util/time';
import { Interval } from '$lib/util/interval';
import { InsertHow, InsertWhat } from '$lib/util/booking/insertionTypes';
import { describe, expect, it } from 'vitest';
import { InsertDirection, InsertWhere } from '../../insertionTypes';
import type { Company, Event } from '../getBookingAvailability';
import type { RoutingResults } from '../routing';
import {
	evaluateBothInsertion,
	SingleInsertionEvaluations,
	type SingleInsertionEvaluation
} from './core';
import { evaluatePairInsertions } from './evaluatePairInsertions';
import { evaluateSingleInsertions } from './evaluateSingleInsertions';
import { getWeightedPassengerDurationDelta } from './insertionMetrics';

const event = (values: Partial<Event>): Event => {
	const result = {
		id: 1,
		tourId: 1,
		isPickup: true,
		passengers: 1,
		scheduledTimeStart: 0,
		scheduledTimeEnd: 0,
		prevLegDuration: 0,
		nextLegDuration: 0,
		departure: 0,
		arrival: 0,
		time: new Interval(0, 0),
		...values
	} as Event;
	result.pickupPassengers ??= result.isPickup ? result.passengers : 0;
	result.dropoffPassengers ??= result.isPickup ? 0 : result.passengers;
	return result;
};

describe('taxi pair insertion timing regressions', () => {
	it('uses pickup and dropoff counts separately for shifted mixed event groups', () => {
		const insertionCase = {
			how: InsertHow.INSERT,
			where: InsertWhere.BETWEEN_EVENTS,
			what: InsertWhat.BOTH,
			direction: InsertDirection.BUS_STOP_PICKUP
		};
		const previousMixedGroup = event({
			isPickup: true,
			passengers: 2,
			pickupPassengers: 3,
			dropoffPassengers: 1
		});
		const nextMixedGroup = event({
			isPickup: true,
			passengers: 1,
			pickupPassengers: 5,
			dropoffPassengers: 4
		});

		expect(
			getWeightedPassengerDurationDelta(insertionCase, previousMixedGroup, nextMixedGroup, 10, 20)
		).toBe(110);
	});

	it('accounts for both event types when narrowing a mixed group around a new pickup', () => {
		const previousMixedGroup = event({
			id: 2,
			isPickup: true,
			passengers: 1,
			pickupPassengers: 3,
			dropoffPassengers: 2,
			scheduledTimeStart: 0,
			scheduledTimeEnd: 485_099,
			nextLegDuration: 1_669_000,
			arrival: 1_669_000,
			time: new Interval(0, 485_099)
		});
		const vehicle = {
			id: 1,
			events: [previousMixedGroup]
		} as unknown as Company['vehicles'][0];
		const insertionCase = {
			how: InsertHow.APPEND,
			where: InsertWhere.BETWEEN_TOURS,
			what: InsertWhat.BOTH,
			direction: InsertDirection.BUS_STOP_PICKUP
		};
		const routing: RoutingResults = {
			busStops: {
				toBusStop: [{ company: [], event: [0] }],
				fromBusStop: [{ company: [], event: [] }]
			},
			userChosen: {
				toUserChosen: { company: [], event: [] },
				fromUserChosen: { company: [637_000], event: [] }
			}
		};

		const result = evaluateBothInsertion(
			insertionCase,
			[new Interval(0, 2_154_099)],
			1_160_000,
			new Interval(239_598, 357_099),
			routing,
			{
				companyIdx: 0,
				vehicle,
				idxInVehicleEvents: 1,
				insertionIdx: 0,
				currentRange: { earliestPickup: 0, latestDropoff: 1 }
			},
			0,
			previousMixedGroup,
			undefined,
			2
		);

		expect(result).toBeDefined();
		expect(result!.scheduledPickupTimeStart).toBe(239_598);
		expect(result!.passengerDuration).toBe(3_355_699);
	});

	it('includes narrowed neighboring event windows in insertion costs', () => {
		const previousEvent = event({
			id: 1,
			isPickup: true,
			scheduledTimeStart: 0,
			scheduledTimeEnd: 100_000,
			nextLegDuration: 1_834_000,
			time: new Interval(0, 100_000)
		});
		const nextEvent = event({
			id: 2,
			isPickup: false,
			scheduledTimeStart: 1_800_000,
			scheduledTimeEnd: 2_200_000,
			prevLegDuration: 1_834_000,
			time: new Interval(1_800_000, 2_200_000)
		});
		const vehicle = {
			id: 1,
			events: [previousEvent, nextEvent]
		} as unknown as Company['vehicles'][0];
		const insertionCase = {
			how: InsertHow.INSERT,
			where: InsertWhere.BETWEEN_EVENTS,
			what: InsertWhat.BOTH,
			direction: InsertDirection.BUS_STOP_PICKUP
		};
		const routing: RoutingResults = {
			busStops: {
				toBusStop: [{ company: [], event: [0, 491_000] }],
				fromBusStop: [{ company: [], event: [] }]
			},
			userChosen: {
				toUserChosen: { company: [], event: [] },
				fromUserChosen: { company: [], event: [0, 253_000] }
			}
		};

		const result = evaluateBothInsertion(
			insertionCase,
			[new Interval(0, 2_200_000)],
			1_090_000,
			new Interval(491_000, 857_000),
			routing,
			{
				companyIdx: 0,
				vehicle,
				idxInVehicleEvents: 1,
				insertionIdx: 1,
				currentRange: { earliestPickup: 0, latestDropoff: 1 }
			},
			0,
			previousEvent,
			nextEvent,
			2
		);

		expect(result).toBeDefined();
		expect(result!.fullyPayedDurationDelta).toBe(0);
		expect(result!.taxiWaitingTime).toBe(500_000);
		expect(result!.passengerDuration).toBe(2_680_000);
	});

	it('does not create an inverted dropoff interval when pair insertion windows overlap', () => {
		const existingEvent = event({
			scheduledTimeStart: 90_000,
			scheduledTimeEnd: 120_000,
			time: new Interval(90_000, 120_000)
		});
		const vehicle = {
			id: 1,
			events: [existingEvent]
		} as unknown as Company['vehicles'][0];
		const companies = [{ vehicles: [vehicle] }] as unknown as Company[];
		const pickup: SingleInsertionEvaluation = {
			arrivalWindow: new Interval(0, 120_000),
			prevLegDuration: 0,
			nextLegDuration: 0,
			insertionType: {
				how: InsertHow.PREPEND,
				what: InsertWhat.BUS_STOP,
				where: InsertWhere.BEFORE_FIRST_EVENT,
				direction: InsertDirection.BUS_STOP_PICKUP
			},
			taxiWaitingTime: 0,
			approachPlusReturnDurationDelta: 0,
			fullyPayedDurationDelta: 0,
			cost: 0,
			previousEventId: undefined,
			nextEventId: existingEvent.id,
			eventInsertionIndex: 0
		};
		const dropoff: SingleInsertionEvaluation = {
			...pickup,
			arrivalWindow: new Interval(90_000, 300_000),
			insertionType: {
				how: InsertHow.APPEND,
				what: InsertWhat.USER_CHOSEN,
				where: InsertWhere.AFTER_LAST_EVENT,
				direction: InsertDirection.BUS_STOP_PICKUP
			},
			previousEventId: existingEvent.id,
			nextEventId: undefined,
			eventInsertionIndex: 1
		};
		const busStopTimes = [[new Interval(0, 300_000)]];
		const singleEvaluations = new SingleInsertionEvaluations(busStopTimes, 2);
		singleEvaluations.addBusStop(0, 0, 0, pickup);
		singleEvaluations.addUserChosen(1, dropoff);

		const result = evaluatePairInsertions(
			companies,
			true,
			new Map([[vehicle.id, [{ earliestPickup: 0, latestDropoff: 1 }]]]),
			busStopTimes,
			singleEvaluations,
			{ passengers: 1, wheelchairs: 0, bikes: 0, luggage: 0 },
			{ lat: 0, lng: 0 },
			[{ lat: 0, lng: 0, times: [0] }]
		)[0][0];

		expect(result).toBeDefined();
		expect(result!.scheduledDropoffTimeStart).toBeLessThanOrEqual(result!.scheduledDropoffTimeEnd);
	});

	it('does not create an inverted dropoff interval from evaluated insertion points', () => {
		const base = Date.now() + 2 * 60 * MINUTE;
		const firstEvent = event({
			id: 1,
			isPickup: true,
			scheduledTimeStart: base + 2 * MINUTE,
			scheduledTimeEnd: base + 2.5 * MINUTE,
			prevLegDuration: 2 * MINUTE,
			nextLegDuration: 7.5 * MINUTE,
			departure: base + 0.5 * MINUTE,
			arrival: base + 13 * MINUTE,
			time: new Interval(base + 2 * MINUTE, base + 2.5 * MINUTE)
		});
		const secondEvent = event({
			id: 2,
			isPickup: false,
			scheduledTimeStart: base + 10 * MINUTE,
			scheduledTimeEnd: base + 11 * MINUTE,
			prevLegDuration: 7.5 * MINUTE,
			nextLegDuration: 2 * MINUTE,
			departure: firstEvent.departure,
			arrival: firstEvent.arrival,
			time: new Interval(base + 10 * MINUTE, base + 11 * MINUTE)
		});
		const availability = new Interval(base - 10 * MINUTE, base + 30 * MINUTE);
		const vehicle = {
			id: 1,
			events: [firstEvent, secondEvent],
			availabilities: [availability],
			tours: [{ departure: firstEvent.departure, arrival: firstEvent.arrival }],
			lastEventBefore: undefined,
			firstEventAfter: undefined
		} as unknown as Company['vehicles'][0];
		const companies = [{ vehicles: [vehicle] }] as unknown as Company[];
		const insertionRanges = new Map([[vehicle.id, [{ earliestPickup: 0, latestDropoff: 1 }]]]);
		const busStopTimes = [
			[new Interval(firstEvent.scheduledTimeEnd - 2 * MINUTE, firstEvent.scheduledTimeEnd)]
		];
		const routing: RoutingResults = {
			busStops: {
				toBusStop: [{ company: [0], event: [0, 0] }],
				fromBusStop: [{ company: [0], event: [0, 0] }]
			},
			userChosen: {
				toUserChosen: { company: [0], event: [0, 0] },
				fromUserChosen: { company: [0], event: [0, 0] }
			}
		};
		const required = { passengers: 1, wheelchairs: 0, bikes: 0, luggage: 0 };
		const { singleEvaluations } = evaluateSingleInsertions(
			companies,
			required,
			true,
			availability,
			insertionRanges,
			busStopTimes,
			routing,
			[5 * MINUTE],
			[availability]
		);
		const pickup = singleEvaluations.getBusStop(0, 0, 0)[0];
		const dropoff = singleEvaluations.getUserChosen(1)[0];
		expect(pickup).toBeDefined();
		expect(dropoff).toBeDefined();
		expect(dropoff.arrivalWindow.startTime).toBeLessThan(pickup.arrivalWindow.endTime);

		const result = evaluatePairInsertions(
			companies,
			true,
			insertionRanges,
			busStopTimes,
			singleEvaluations,
			required,
			{ lat: 0, lng: 0 },
			[{ lat: 0, lng: 0, times: [0] }]
		)[0][0];

		expect(result).toBeDefined();
		expect(result!.scheduledDropoffTimeStart).toBeLessThanOrEqual(result!.scheduledDropoffTimeEnd);
	});

	it('includes existing route legs in the passenger driving duration', () => {
		const firstEvent = event({ id: 1, nextLegDuration: 100, arrival: 100 });
		const secondEvent = event({
			id: 2,
			isPickup: false,
			prevLegDuration: 100,
			arrival: 100
		});
		const vehicle = {
			id: 1,
			events: [firstEvent, secondEvent]
		} as unknown as Company['vehicles'][0];
		const companies = [{ vehicles: [vehicle] }] as unknown as Company[];
		const busStopTimes = [[new Interval(0, 300)]];
		const singleEvaluations = new SingleInsertionEvaluations(busStopTimes, 3);
		const pickup: SingleInsertionEvaluation = {
			arrivalWindow: new Interval(0, 0),
			prevLegDuration: 0,
			nextLegDuration: 10,
			insertionType: {
				how: InsertHow.PREPEND,
				what: InsertWhat.BUS_STOP,
				where: InsertWhere.BEFORE_FIRST_EVENT,
				direction: InsertDirection.BUS_STOP_PICKUP
			},
			taxiWaitingTime: 0,
			approachPlusReturnDurationDelta: 0,
			fullyPayedDurationDelta: 0,
			cost: 0,
			previousEventId: undefined,
			nextEventId: firstEvent.id,
			eventInsertionIndex: 0
		};
		const dropoff: SingleInsertionEvaluation = {
			...pickup,
			arrivalWindow: new Interval(0, 300),
			prevLegDuration: 20,
			nextLegDuration: 0,
			insertionType: {
				how: InsertHow.APPEND,
				what: InsertWhat.USER_CHOSEN,
				where: InsertWhere.AFTER_LAST_EVENT,
				direction: InsertDirection.BUS_STOP_PICKUP
			},
			previousEventId: secondEvent.id,
			nextEventId: undefined,
			eventInsertionIndex: 2
		};
		singleEvaluations.addBusStop(0, 0, 0, pickup);
		singleEvaluations.addUserChosen(2, dropoff);

		const result = evaluatePairInsertions(
			companies,
			true,
			new Map([[vehicle.id, [{ earliestPickup: 0, latestDropoff: 2 }]]]),
			busStopTimes,
			singleEvaluations,
			{ passengers: 1, wheelchairs: 0, bikes: 0, luggage: 0 },
			{ lat: 0, lng: 0 },
			[{ lat: 0, lng: 0, times: [0] }]
		)[0][0];

		expect(result).toBeDefined();
		expect(result!.scheduledDropoffTimeStart - result!.scheduledPickupTimeEnd).toBe(130);
	});

	it('uses the narrowed shared event-group interval for pair insertion costs', () => {
		const previousDropoff = event({
			id: 1,
			isPickup: false,
			scheduledTimeStart: 200,
			scheduledTimeEnd: 200,
			nextLegDuration: 100,
			lat: 3,
			lng: 3,
			departure: 0,
			arrival: 300,
			time: new Interval(200, 200)
		});
		const nextPickup = event({
			id: 2,
			isPickup: true,
			scheduledTimeStart: 300,
			scheduledTimeEnd: 300,
			prevLegDuration: 100,
			lat: 2,
			lng: 2,
			departure: 0,
			arrival: 300,
			time: new Interval(300, 300)
		});
		const vehicle = {
			id: 1,
			events: [previousDropoff, nextPickup]
		} as unknown as Company['vehicles'][0];
		const companies = [{ vehicles: [vehicle] }] as unknown as Company[];
		const busStopTimes = [[new Interval(0, 0)]];
		const singleEvaluations = new SingleInsertionEvaluations(busStopTimes, 3);
		const pickup: SingleInsertionEvaluation = {
			arrivalWindow: new Interval(0, 0),
			prevLegDuration: 0,
			nextLegDuration: 100,
			insertionType: {
				how: InsertHow.PREPEND,
				what: InsertWhat.BUS_STOP,
				where: InsertWhere.BEFORE_FIRST_EVENT,
				direction: InsertDirection.BUS_STOP_PICKUP
			},
			taxiWaitingTime: 0,
			approachPlusReturnDurationDelta: 0,
			fullyPayedDurationDelta: 0,
			cost: 0,
			previousEventId: undefined,
			nextEventId: previousDropoff.id,
			eventInsertionIndex: 0
		};
		const dropoff: SingleInsertionEvaluation = {
			...pickup,
			arrivalWindow: new Interval(250, 300),
			prevLegDuration: 100,
			nextLegDuration: 0,
			insertionType: {
				how: InsertHow.INSERT,
				what: InsertWhat.USER_CHOSEN,
				where: InsertWhere.BETWEEN_EVENTS,
				direction: InsertDirection.BUS_STOP_PICKUP
			},
			previousEventId: previousDropoff.id,
			nextEventId: nextPickup.id,
			eventInsertionIndex: 1
		};
		singleEvaluations.addBusStop(0, 0, 0, pickup);
		singleEvaluations.addUserChosen(1, dropoff);

		const result = evaluatePairInsertions(
			companies,
			true,
			new Map([[vehicle.id, [{ earliestPickup: 0, latestDropoff: 1 }]]]),
			busStopTimes,
			singleEvaluations,
			{ passengers: 1, wheelchairs: 0, bikes: 0, luggage: 0 },
			{ lat: 2, lng: 2 },
			[{ lat: 1, lng: 1, times: [0] }]
		)[0][0];

		expect(result).toBeDefined();
		expect(result!.scheduledPickupTimeEnd).toBe(0);
		expect(result!.scheduledDropoffTimeStart).toBe(300);
		expect(result!.scheduledDropoffTimeEnd).toBe(300);
		expect(result!.passengerDuration).toBe(300);
	});
	it('does not count an existing pickup event-group window as a passenger delay', () => {
		const existingPickup = event({
			id: 1,
			eventGroupId: 1,
			isPickup: true,
			passengers: 2,
			scheduledTimeStart: 1_919_000,
			scheduledTimeEnd: 1_979_000,
			prevLegDuration: 0,
			nextLegDuration: 1_021_000,
			lat: 2,
			lng: 2,
			departure: 0,
			arrival: 3_000_000,
			time: new Interval(1_919_000, 1_979_000)
		});
		const existingDropoff = event({
			id: 2,
			eventGroupId: 2,
			isPickup: false,
			passengers: 2,
			scheduledTimeStart: 3_000_000,
			scheduledTimeEnd: 3_000_000,
			prevLegDuration: 1_021_000,
			nextLegDuration: 0,
			lat: 3,
			lng: 3,
			departure: 0,
			arrival: 3_000_000,
			time: new Interval(3_000_000, 3_000_000)
		});
		const vehicle = {
			id: 1,
			events: [existingPickup, existingDropoff]
		} as unknown as Company['vehicles'][0];
		const companies = [{ vehicles: [vehicle] }] as unknown as Company[];
		const busStopTimes = [[new Interval(0, 0)]];
		const singleEvaluations = new SingleInsertionEvaluations(busStopTimes, 3);
		const pickup: SingleInsertionEvaluation = {
			arrivalWindow: new Interval(0, 0),
			prevLegDuration: 0,
			nextLegDuration: 1_919_000,
			insertionType: {
				how: InsertHow.PREPEND,
				what: InsertWhat.BUS_STOP,
				where: InsertWhere.BEFORE_FIRST_EVENT,
				direction: InsertDirection.BUS_STOP_PICKUP
			},
			taxiWaitingTime: 0,
			approachPlusReturnDurationDelta: 0,
			fullyPayedDurationDelta: 0,
			cost: 0,
			previousEventId: undefined,
			nextEventId: existingPickup.id,
			eventInsertionIndex: 0
		};
		const dropoff: SingleInsertionEvaluation = {
			...pickup,
			arrivalWindow: new Interval(1_919_000, 1_979_000),
			prevLegDuration: 0,
			nextLegDuration: 1_021_000,
			insertionType: {
				how: InsertHow.INSERT,
				what: InsertWhat.USER_CHOSEN,
				where: InsertWhere.BETWEEN_EVENTS,
				direction: InsertDirection.BUS_STOP_PICKUP
			},
			previousEventId: existingPickup.id,
			nextEventId: existingDropoff.id,
			eventInsertionIndex: 1
		};
		singleEvaluations.addBusStop(0, 0, 0, pickup);
		singleEvaluations.addUserChosen(1, dropoff);

		const result = evaluatePairInsertions(
			companies,
			true,
			new Map([[vehicle.id, [{ earliestPickup: 0, latestDropoff: 1 }]]]),
			busStopTimes,
			singleEvaluations,
			{ passengers: 1, wheelchairs: 0, bikes: 0, luggage: 0 },
			{ lat: 2, lng: 2 },
			[{ lat: 1, lng: 1, times: [0] }]
		)[0][0];

		expect(result).toBeDefined();
		expect(result!.scheduledDropoffTimeStart).toBe(1_919_000);
		expect(result!.scheduledDropoffTimeEnd).toBe(1_979_000);
		expect(result!.passengerDuration).toBe(1_919_000);
	});
	it('accounts for pickups and dropoffs separately when narrowing a mixed event group', () => {
		const mixedEventGroup = event({
			id: 1,
			eventGroupId: 1,
			isPickup: true,
			passengers: 2,
			pickupPassengers: 3,
			dropoffPassengers: 1,
			scheduledTimeStart: 1_000,
			scheduledTimeEnd: 1_060,
			nextLegDuration: 1_000,
			lat: 2,
			lng: 2,
			departure: 1_000,
			arrival: 2_000,
			time: new Interval(1_000, 1_060)
		});
		const existingDropoff = event({
			id: 2,
			eventGroupId: 2,
			isPickup: false,
			passengers: 3,
			scheduledTimeStart: 2_000,
			scheduledTimeEnd: 2_000,
			prevLegDuration: 1_000,
			lat: 3,
			lng: 3,
			departure: 1_000,
			arrival: 2_000,
			time: new Interval(2_000, 2_000)
		});
		const vehicle = {
			id: 1,
			events: [mixedEventGroup, existingDropoff]
		} as unknown as Company['vehicles'][0];
		const companies = [{ vehicles: [vehicle] }] as unknown as Company[];
		const busStopTimes = [[new Interval(1_560, 1_560)]];
		const singleEvaluations = new SingleInsertionEvaluations(busStopTimes, 3);
		const pickup: SingleInsertionEvaluation = {
			arrivalWindow: new Interval(1_000, 1_000),
			prevLegDuration: 0,
			nextLegDuration: 0,
			insertionType: {
				how: InsertHow.PREPEND,
				what: InsertWhat.USER_CHOSEN,
				where: InsertWhere.BEFORE_FIRST_EVENT,
				direction: InsertDirection.BUS_STOP_DROPOFF
			},
			taxiWaitingTime: 0,
			approachPlusReturnDurationDelta: 0,
			fullyPayedDurationDelta: 0,
			cost: 0,
			previousEventId: undefined,
			nextEventId: mixedEventGroup.id,
			eventInsertionIndex: 0
		};
		const dropoff: SingleInsertionEvaluation = {
			...pickup,
			arrivalWindow: new Interval(1_560, 1_560),
			prevLegDuration: 500,
			nextLegDuration: 440,
			insertionType: {
				how: InsertHow.INSERT,
				what: InsertWhat.BUS_STOP,
				where: InsertWhere.BETWEEN_EVENTS,
				direction: InsertDirection.BUS_STOP_DROPOFF
			},
			previousEventId: mixedEventGroup.id,
			nextEventId: existingDropoff.id,
			eventInsertionIndex: 1
		};
		singleEvaluations.addUserChosen(0, pickup);
		singleEvaluations.addBusStop(0, 0, 1, dropoff);

		const result = evaluatePairInsertions(
			companies,
			false,
			new Map([[vehicle.id, [{ earliestPickup: 0, latestDropoff: 1 }]]]),
			busStopTimes,
			singleEvaluations,
			{ passengers: 3, wheelchairs: 0, bikes: 0, luggage: 0 },
			{ lat: 2, lng: 2 },
			[{ lat: 1, lng: 1, times: [1_560] }]
		)[0][0];

		expect(result).toBeDefined();
		expect(result!.scheduledPickupTimeStart).toBe(1_000);
		expect(result!.scheduledPickupTimeEnd).toBe(1_000);
		expect(result!.passengerDuration).toBe(1_860);
	});
});
