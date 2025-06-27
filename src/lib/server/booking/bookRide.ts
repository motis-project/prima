import type { Transaction } from 'kysely';
import type { Capacities } from '$lib/util/booking/Capacities';
import type { Database } from '$lib/server/db';
import { Interval } from '$lib/util/interval';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';
import { getBookingAvailability } from '$lib/server/booking/getBookingAvailability';
import type { Coordinates } from '$lib/util/Coordinates';
import { evaluateRequest } from '$lib/server/booking/evaluateRequest';
import { getDirectDurations, type DirectDrivingDurations } from './getDirectDrivingDurations';
import { getMergeTourList } from './getMergeTourList';
import { InsertHow, InsertWhat } from '$lib/util/booking/insertionTypes';
import { printInsertionType } from './insertionTypes';
import { bookingLogs, increment } from '$lib/testHelpers';
import type { Insertion } from './insertion';
import { comesFromCompany, returnsToCompany } from './durations';
import { getScheduledTimes, type ScheduledTimes } from './getScheduledTimes';
import { getLegDurationUpdates } from './getLegDurationUpdates';
import { DAY } from '$lib/util/time';
import { getFirstAndLastEvents } from './getFirstAndLastEvents';

export type ExpectedConnection = {
	start: Coordinates;
	target: Coordinates;
	startTime: UnixtimeMs;
	targetTime: UnixtimeMs;
	signature: string;
	startFixed: boolean;
};

export type ExpectedConnectionWithISoStrings = {
	start: Coordinates;
	target: Coordinates;
	startTime: string;
	targetTime: string;
};

export function toExpectedConnectionWithISOStrings(
	c: ExpectedConnection | null
): ExpectedConnectionWithISoStrings | null {
	return c == null
		? null
		: {
				...c,
				startTime: new Date(c.startTime).toISOString(),
				targetTime: new Date(c.targetTime).toISOString()
			};
}

export async function bookRide(
	c: ExpectedConnection,
	required: Capacities,
	trx?: Transaction<Database>,
	skipPromiseCheck?: boolean,
	blockedVehicleId?: number
): Promise<undefined | BookRideResponse> {
	bookingLogs.push({ iter: -1 });
	console.log('BS');
	const searchInterval = new Interval(c.startTime, c.targetTime);
	const expandedSearchInterval = searchInterval.expand(DAY, DAY);
	const userChosen = !c.startFixed ? c.start : c.target;
	const busStop = c.startFixed ? c.start : c.target;
	const { companies, filteredBusStops } = await getBookingAvailability(
		userChosen,
		required,
		searchInterval,
		[busStop],
		trx
	);
	if (companies.length == 0 || filteredBusStops[0] == undefined) {
		console.log(
			'there were no vehicles with corrcet zone, capacity and availability or tour for concatenation.',
			{ filteredBusStops }
		);
		return undefined;
	}
	if (blockedVehicleId != undefined && blockedVehicleId != null) {
		const blockedVehicleCompanyIdx = companies.findIndex((c) =>
			c.vehicles.some((v) => v.id == blockedVehicleId)
		);
		if (blockedVehicleCompanyIdx != -1) {
			companies[blockedVehicleCompanyIdx].vehicles = companies[
				blockedVehicleCompanyIdx
			].vehicles.filter((v) => v.id != blockedVehicleId);
		}
	}
	const busTime = c.startFixed ? c.startTime : c.targetTime;
	const best = (
		await evaluateRequest(
			companies,
			expandedSearchInterval,
			userChosen,
			[{ ...busStop, times: [busTime] }],
			required,
			c.startFixed,
			skipPromiseCheck
				? undefined
				: {
						pickup: c.startTime,
						dropoff: c.targetTime
					}
		)
	)[0][0];
	if (best == undefined) {
		console.log('surprisingly no possible connection found: ', userChosen, busStop, busTime, best);
		return undefined;
	}
	console.log({ best }, printInsertionType(best.pickupCase), printInsertionType(best.dropoffCase));
	const vehicle = companies[best.company].vehicles.find((v) => v.id === best.vehicle)!;
	const events = vehicle.events;
	console.log('BE');
	const prevPickupEvent = comesFromCompany(best.pickupCase)
		? best.pickupIdx == undefined
			? undefined
			: events[best.pickupIdx - 1]
		: events.find((e) => e.id === best.prevPickupId);
	const nextPickupEvent =
		InsertWhat.BOTH === best.pickupCase.what
			? undefined
			: returnsToCompany(best.pickupCase)
				? best.pickupIdx == undefined
					? undefined
					: events[best.pickupIdx]
				: events.find((e) => e.id === best.nextPickupId);
	const prevDropoffEvent =
		InsertWhat.BOTH === best.pickupCase.what
			? undefined
			: comesFromCompany(best.dropoffCase)
				? best.dropoffIdx == undefined
					? undefined
					: events[best.dropoffIdx - 1]
				: events.find((e) => e.id === best.prevDropoffId);
	const nextDropoffEvent = returnsToCompany(best.dropoffCase)
		? best.dropoffIdx == undefined
			? undefined
			: events[best.dropoffIdx]
		: events.find((e) => e.id === best.nextDropoffId);
	increment();
	let mergeTourList = getMergeTourList(
		events,
		best.pickupCase.how,
		best.dropoffCase.how,
		best.pickupIdx,
		best.dropoffIdx
	);
	// If it is necessary to merge tours, find the first/last events of each such tour..
	const { firstEvents, lastEvents, departure, arrival } = getFirstAndLastEvents(
		mergeTourList,
		best,
		events
	);
	if (mergeTourList.length == 1) {
		mergeTourList = [];
	}
	const { prevLegDurations, nextLegDurations } = await getLegDurationUpdates(
		firstEvents,
		lastEvents
	);

	let prevEventInOtherTour =
		best.pickupCase.how == InsertHow.NEW_TOUR
			? events.findLast((e) => e.scheduledTimeStart <= best.pickupTime)
			: events.find((e) => e.id === best.prevPickupId);
	if (prevEventInOtherTour === undefined) {
		prevEventInOtherTour = vehicle.lastEventBefore;
	}
	let nextEventInOtherTour =
		best.pickupCase.how == InsertHow.NEW_TOUR
			? events.find((e) => e.scheduledTimeEnd >= best.dropoffTime)
			: events.find((e) => best.nextDropoffId === e.id);
	if (nextEventInOtherTour === undefined) {
		nextEventInOtherTour = vehicle.firstEventAfter;
	}
	const directDurations = await getDirectDurations(
		best,
		prevEventInOtherTour,
		nextEventInOtherTour,
		c,
		events[best.pickupIdx ?? -1]?.tourId,
		mergeTourList.length !== 0,
		departure,
		arrival,
		vehicle
	);
	const scheduledTimes = getScheduledTimes(
		best.pickupTime,
		best.dropoffTime,
		prevPickupEvent,
		nextPickupEvent,
		nextDropoffEvent,
		prevDropoffEvent,
		firstEvents.some((e) => e.id === nextPickupEvent?.id) &&
			best.pickupIdx &&
			lastEvents.some((e) => e.id === prevPickupEvent?.id)
			? Math.max(best.pickupPrevLegDuration, directDurations.thisTour?.directDrivingDuration ?? 0)
			: best.pickupPrevLegDuration,
		best.pickupNextLegDuration,
		best.dropoffPrevLegDuration,
		firstEvents.some((e) => e.id === nextDropoffEvent?.id) &&
			best.dropoffIdx &&
			lastEvents.some((e) => e.id === prevDropoffEvent?.id)
			? Math.max(best.dropoffNextLegDuration, directDurations.nextTour?.directDrivingDuration ?? 0)
			: best.dropoffNextLegDuration,
		firstEvents,
		lastEvents
	);

	// Update arrival and departure depending on new scheduled times
	if (best.pickupCase.how === InsertHow.INSERT && prevPickupEvent) {
		const update = scheduledTimes.updates.find(
			(upd) => upd.event_id === prevPickupEvent.id && !upd.start && prevPickupEvent.isPickup
		);
		const sameTourEvents = events
			.filter((e) => e.tourId === prevPickupEvent.tourId)
			.sort((e1, e2) => e1.scheduledTimeStart - e2.scheduledTimeStart);
		if (update && sameTourEvents[0].id === prevPickupEvent.id) {
			best.departure =
				(best.departure ?? prevPickupEvent.departure) -
				(prevPickupEvent.scheduledTimeEnd - update.time);
		}
	}
	if (best.dropoffCase.how === InsertHow.INSERT && nextDropoffEvent) {
		const update = scheduledTimes.updates.find(
			(upd) => upd.event_id === nextDropoffEvent.id && upd.start && !nextDropoffEvent.isPickup
		);
		const sameTourEvents = events
			.filter((e) => e.tourId === nextDropoffEvent.tourId)
			.sort((e1, e2) => e2.scheduledTimeStart - e1.scheduledTimeStart);
		if (update && sameTourEvents[0].id === nextDropoffEvent.id) {
			best.arrival =
				(best.arrival ?? nextDropoffEvent.arrival) +
				(update.time - nextDropoffEvent.scheduledTimeStart);
		}
	}

	return {
		best,
		tour: (() => {
			switch (best.pickupCase.how) {
				case InsertHow.NEW_TOUR:
					return undefined;
				case InsertHow.PREPEND:
					return best.pickupCase.what === InsertWhat.BOTH
						? nextDropoffEvent!.tourId
						: nextPickupEvent!.tourId;
				default:
					return prevPickupEvent!.tourId;
			}
		})(),
		mergeTourList: Array.from(mergeTourList).map((t) => t.tourId),
		neighbourIds: {
			prevPickup: best.pickupCase.how == InsertHow.PREPEND ? undefined : prevPickupEvent?.id,
			nextPickup: best.pickupCase.how == InsertHow.APPEND ? undefined : nextPickupEvent?.id,
			prevDropoff: best.dropoffCase.how == InsertHow.PREPEND ? undefined : prevDropoffEvent?.id,
			nextDropoff: best.dropoffCase.how == InsertHow.APPEND ? undefined : nextDropoffEvent?.id
		},
		directDurations,
		prevLegDurations,
		nextLegDurations,
		scheduledTimes
	};
}

export type BookRideResponse = {
	best: Insertion;
	tour: undefined | number;
	mergeTourList: number[];
	neighbourIds: {
		prevPickup: undefined | number;
		nextPickup: undefined | number;
		prevDropoff: undefined | number;
		nextDropoff: undefined | number;
	};
	directDurations: DirectDrivingDurations;
	prevLegDurations: { event: number; duration: number | null }[];
	nextLegDurations: { event: number; duration: number | null }[];
	scheduledTimes: ScheduledTimes;
};
