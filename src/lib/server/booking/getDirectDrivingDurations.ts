import type { ExpectedConnection } from './bookRide';
import { oneToManyCarRouting } from '../util/oneToManyCarRouting';
import type { Insertion } from './insertion';
import { InsertHow } from './insertionTypes';
import { type Event } from './getBookingAvailability';

export type DirectDrivingDurations = {
	thisTour?: {
		directDrivingDuration: number;
		tourId: number | null;
	};
	nextTour?: {
		directDrivingDuration: number;
		tourId: number | null;
	};
};

export const getDirectDurations = async (
	best: Insertion,
	pickupPredEvent: Event | undefined,
	dropOffSuccEvent: Event | undefined,
	c: ExpectedConnection,
	tourIdPickup: number | undefined
): Promise<DirectDrivingDurations> => {
	const direct: DirectDrivingDurations = {};

	if (
		(best.pickupCase.how == InsertHow.PREPEND || best.pickupCase.how == InsertHow.NEW_TOUR) &&
		pickupPredEvent != undefined
	) {
		direct.thisTour = {
			directDrivingDuration:
				(await oneToManyCarRouting(pickupPredEvent, [c.start], false))[0] ?? null,
			tourId: tourIdPickup ?? null
		};
	}

	if (
		(best.dropoffCase.how == InsertHow.APPEND || best.dropoffCase.how == InsertHow.NEW_TOUR) &&
		dropOffSuccEvent != undefined
	) {
		direct.nextTour = {
			directDrivingDuration:
				(await oneToManyCarRouting(c.target, [dropOffSuccEvent], false))[0] ?? null,
			tourId: dropOffSuccEvent.tourId
		};
	}

	return direct;
};
