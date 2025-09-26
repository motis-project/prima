import type { ExpectedConnection } from './bookRide';
import { oneToManyCarRouting } from '$lib/server/util/oneToManyCarRouting';
import type { Insertion } from './insertion';
import { type Event, type VehicleWithInterval } from './getBookingAvailability';
import { InsertHow } from '$lib/util/booking/insertionTypes';
import { getScheduledEventTime } from '$lib/util/getScheduledEventTime';
import { PASSENGER_CHANGE_DURATION } from '$lib/constants';

export type DirectDrivingDurations = {
	thisTour?: {
		directDrivingDuration: number | null;
		tourId: number | null;
	};
	nextTour?: {
		directDrivingDuration: number | null;
		tourId: number | null;
	};
};

export const getDirectDurations = async (
	best: Insertion,
	pickupPredEvent: Event | undefined,
	dropOffSuccEvent: Event | undefined,
	c: ExpectedConnection,
	tourIdPickup: number | undefined,
	doesConnectTours: boolean,
	departure: number,
	arrival: number,
	vehicle: VehicleWithInterval
): Promise<DirectDrivingDurations> => {
	const direct: DirectDrivingDurations = {};
	if (
		(best.pickupCase.how == InsertHow.PREPEND || best.pickupCase.how == InsertHow.NEW_TOUR) &&
		pickupPredEvent != undefined
	) {
		const routing = (await oneToManyCarRouting(pickupPredEvent, [c.start], false))[0];
		direct.thisTour = {
			directDrivingDuration: routing === undefined ? null : routing + PASSENGER_CHANGE_DURATION,
			tourId: tourIdPickup ?? null
		};
	}

	if (
		(best.dropoffCase.how == InsertHow.APPEND || best.dropoffCase.how == InsertHow.NEW_TOUR) &&
		dropOffSuccEvent != undefined
	) {
		const routing = (await oneToManyCarRouting(c.target, [dropOffSuccEvent], false))[0];
		direct.nextTour = {
			directDrivingDuration: routing === undefined ? null : routing + PASSENGER_CHANGE_DURATION,
			tourId: dropOffSuccEvent.tourId
		};
	}
	if (doesConnectTours) {
		const lastEventBeforeDeparture =
			vehicle.events.findLast((e) => getScheduledEventTime(e) <= departure) ??
			vehicle.lastEventBefore;
		const firstEventAfterDeparture = vehicle.events.find(
			(e) => getScheduledEventTime(e) > departure
		);
		const firstEventAfterArrival =
			vehicle.events.find((e) => getScheduledEventTime(e) >= arrival) ?? vehicle.firstEventAfter;
		const lastEventBeforeArrival = vehicle.events.findLast(
			(e) => getScheduledEventTime(e) < arrival
		);
		if (best.pickupCase.how !== InsertHow.PREPEND && lastEventBeforeDeparture !== undefined) {
			const routing = (
				await oneToManyCarRouting(lastEventBeforeDeparture, [firstEventAfterDeparture!], false)
			)[0];
			direct.thisTour = {
				directDrivingDuration: routing === undefined ? null : routing + PASSENGER_CHANGE_DURATION,
				tourId: tourIdPickup ?? null
			};
		}
		if (best.dropoffCase.how !== InsertHow.APPEND && firstEventAfterArrival !== undefined) {
			const routing = (
				await oneToManyCarRouting(lastEventBeforeArrival!, [firstEventAfterArrival], false)
			)[0];
			direct.nextTour = {
				directDrivingDuration: routing === undefined ? null : routing + PASSENGER_CHANGE_DURATION,
				tourId: firstEventAfterArrival.tourId ?? null
			};
		}
	}
	return direct;
};
