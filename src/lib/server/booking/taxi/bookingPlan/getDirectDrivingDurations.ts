import type { ExpectedConnection } from '$lib/server/booking/expectedConnection';
import type { Insertion } from '../insertion';
import { type Event, type VehicleWithInterval } from '../getBookingAvailability';
import { InsertHow } from '$lib/util/booking/insertionTypes';
import { PASSENGER_CHANGE_DURATION } from '$lib/constants';
import { oneToManyCarRouting } from '$lib/server/util/oneToManyCarRouting';
import {
	getFirstEventOfEarliestTourStartingAfter,
	getFirstEventOfTours,
	getLastEventOfLatestTourEndingBefore,
	getLastEventOfTours
} from './tourBoundaryEvents';

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
	mergeTourIds: number[],
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
	if (mergeTourIds.length !== 0) {
		const mergedTourIds = new Set(mergeTourIds);
		const firstEventInMergedTours = getFirstEventOfTours(vehicle.events, mergedTourIds);
		const lastEventInMergedTours = getLastEventOfTours(vehicle.events, mergedTourIds);
		const lastEventBeforeDeparture =
			getLastEventOfLatestTourEndingBefore(vehicle.events, departure, mergedTourIds) ??
			vehicle.lastEventBefore;
		const firstEventAfterArrival =
			getFirstEventOfEarliestTourStartingAfter(vehicle.events, arrival, mergedTourIds) ??
			vehicle.firstEventAfter;
		if (
			best.pickupCase.how !== InsertHow.PREPEND &&
			lastEventBeforeDeparture !== undefined &&
			firstEventInMergedTours !== undefined
		) {
			const routing = (
				await oneToManyCarRouting(lastEventBeforeDeparture, [firstEventInMergedTours], false)
			)[0];
			direct.thisTour = {
				directDrivingDuration: routing === undefined ? null : routing + PASSENGER_CHANGE_DURATION,
				tourId: tourIdPickup ?? null
			};
		}
		if (
			best.dropoffCase.how !== InsertHow.APPEND &&
			lastEventInMergedTours !== undefined &&
			firstEventAfterArrival !== undefined
		) {
			const routing = (
				await oneToManyCarRouting(lastEventInMergedTours, [firstEventAfterArrival], false)
			)[0];
			direct.nextTour = {
				directDrivingDuration: routing === undefined ? null : routing + PASSENGER_CHANGE_DURATION,
				tourId: firstEventAfterArrival.tourId ?? null
			};
		}
	}
	return direct;
};
