import {
	APPROACH_AND_RETURN_TIME_COST_FACTOR,
	FULLY_PAYED_COST_FACTOR,
	MAX_WAITING_TIME,
	PASSENGER_TIME_COST_FACTOR,
	TAXI_WAITING_TIME_COST_FACTOR
} from '$lib/constants';
import type { InsertionType } from '../insertionTypes';
import { comesFromCompany, returnsToCompany } from './durations';
import type { Event } from './getBookingAvailability';

export function computeCost(
	passengerDuration: number,
	approachPlusReturnDurationDelta: number,
	fullyPayedDurationDelta: number,
	taxiWaitingTime: number
): number {
	return (
		APPROACH_AND_RETURN_TIME_COST_FACTOR * approachPlusReturnDurationDelta +
		FULLY_PAYED_COST_FACTOR * fullyPayedDurationDelta +
		PASSENGER_TIME_COST_FACTOR * passengerDuration +
		TAXI_WAITING_TIME_COST_FACTOR * taxiWaitingTime
	);
}

export function getWeightedPassengerDurationDelta(
	type: InsertionType,
	prev: Event | undefined,
	next: Event | undefined,
	prevShift: number,
	nextShift: number
): number {
	const passengersEnteringInPrev = !comesFromCompany(type) && prev!.isPickup ? prev!.passengers : 0;
	const passengerExitingAtNext = !returnsToCompany(type) && !next!.isPickup ? next!.passengers : 0;
	return passengersEnteringInPrev * prevShift + passengerExitingAtNext * nextShift;
}

export function waitsTooLong(waitingTime: number): boolean {
	return waitingTime > MAX_WAITING_TIME;
}
