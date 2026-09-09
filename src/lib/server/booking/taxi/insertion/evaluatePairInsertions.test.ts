import { MINUTE } from '$lib/util/time';
import { Interval } from '$lib/util/interval';
import { InsertHow, InsertWhat } from '$lib/util/booking/insertionTypes';
import { describe, expect, it } from 'vitest';
import { InsertDirection, InsertWhere } from '../../insertionTypes';
import type { Company, Event } from '../getBookingAvailability';
import type { RoutingResults } from '../routing';
import { SingleInsertionEvaluations, type SingleInsertionEvaluation } from './core';
import { evaluatePairInsertions } from './evaluatePairInsertions';
import { evaluateSingleInsertions } from './evaluateSingleInsertions';

const event = (values: Partial<Event>): Event =>
	({
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
	}) as unknown as Event;

describe('taxi pair insertion timing regressions', () => {
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
			{ passengers: 1, wheelchairs: 0, bikes: 0, luggage: 0 }
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
			required
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
			{ passengers: 1, wheelchairs: 0, bikes: 0, luggage: 0 }
		)[0][0];

		expect(result).toBeDefined();
		expect(result!.scheduledDropoffTimeStart - result!.scheduledPickupTimeEnd).toBe(130);
	});
});
