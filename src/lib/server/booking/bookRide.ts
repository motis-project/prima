import type { Transaction } from 'kysely';
import type { Capacities } from '$lib/util/booking/Capacities';
import type { Database } from '$lib/server/db';
import { Interval } from '$lib/util/interval';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';
import { getBookingAvailability, type Event } from '$lib/server/booking/getBookingAvailability';
import type { Coordinates } from '$lib/util/Coordinates';
import { evaluateRequest } from '$lib/server/booking/evaluateRequest';
import { getDirectDurations, type DirectDrivingDurations } from './getDirectDrivingDurations';
import { getMergeTourList } from './getMergeTourList';
import { InsertHow, InsertWhat } from '$lib/util/booking/insertionTypes';
import { printInsertionType } from './insertionTypes';
import { toInsertionWithISOStrings, type Insertion, type NeighbourIds } from './insertion';
import { comesFromCompany, returnsToCompany } from './durations';
import { getScheduledTimes, type ScheduledTimes } from './getScheduledTimes';
import { getLegDurationUpdates } from './getLegDurationUpdates';
import { DAY } from '$lib/util/time';
import { getFirstAndLastEvents } from './getFirstAndLastEvents';
import { isSamePlace } from './isSamePlace';

export type ExpectedConnection = {
	start: Coordinates;
	target: Coordinates;
	startTime: UnixtimeMs;
	targetTime: UnixtimeMs;
	signature: string;
	startFixed: boolean;
	requestedTime: UnixtimeMs;
};

export type ExpectedConnectionWithISoStrings = {
	start: Coordinates;
	target: Coordinates;
	startTime: string;
	targetTime: string;
	requestedTime: string;
};

export function toExpectedConnectionWithISOStrings(
	c: ExpectedConnection | null
): ExpectedConnectionWithISoStrings | null {
	return c == null
		? null
		: {
				...c,
				startTime: new Date(c.startTime).toISOString(),
				targetTime: new Date(c.targetTime).toISOString(),
				requestedTime: new Date(c.requestedTime).toISOString()
			};
}

export async function bookRide(
	c: ExpectedConnection,
	required: Capacities,
	trx?: Transaction<Database>,
	skipPromiseCheck?: boolean,
	blockedVehicleId?: number
): Promise<undefined | BookRideResponse> {
	console.log('BS');
	const searchInterval = new Interval(c.startTime, c.targetTime);
	const expandedSearchInterval = searchInterval.expand(DAY, DAY);
	const userChosen = !c.startFixed ? c.start : c.target;
	const busStop = c.startFixed ? c.start : c.target;
	const { companies, filteredBusStops } = await getBookingAvailability(
		userChosen,
		required,
		expandedSearchInterval,
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
	const best = (
		await evaluateRequest(
			companies,
			expandedSearchInterval,
			userChosen,
			[{ ...busStop, times: [c.requestedTime] }],
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
		console.log(
			'surprisingly no possible connection found: ',
			userChosen,
			busStop,
			c.requestedTime,
			best
		);
		return undefined;
	}
	console.log(
		{ best: toInsertionWithISOStrings(best) },
		printInsertionType(best.pickupCase),
		printInsertionType(best.dropoffCase)
	);
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
	let pickupEventGroup = undefined;
	let dropoffEventGroup = undefined;
	const pickupInterval = new Interval(best.scheduledPickupTimeStart, best.scheduledPickupTimeEnd);
	const dropoffInterval = new Interval(
		best.scheduledDropoffTimeStart,
		best.scheduledDropoffTimeEnd
	);
	if (belongToSameEventGroup(prevPickupEvent, c.start, pickupInterval)) {
		pickupEventGroup = prevPickupEvent!.eventGroupId;
	}
	if (belongToSameEventGroup(nextPickupEvent, c.start, pickupInterval)) {
		pickupEventGroup = nextPickupEvent!.eventGroupId;
	}
	if (belongToSameEventGroup(prevDropoffEvent, c.target, dropoffInterval)) {
		dropoffEventGroup = prevDropoffEvent!.eventGroupId;
	}
	if (belongToSameEventGroup(nextDropoffEvent, c.target, dropoffInterval)) {
		dropoffEventGroup = nextDropoffEvent!.eventGroupId;
	}
	const { prevLegDurations, nextLegDurations } = await getLegDurationUpdates(
		firstEvents,
		lastEvents,
		prevPickupEvent,
		nextPickupEvent,
		prevDropoffEvent,
		nextDropoffEvent,
		pickupEventGroup,
		dropoffEventGroup,
		best
	);

	let prevEventInOtherTour =
		best.pickupCase.how == InsertHow.NEW_TOUR
			? events.findLast((e) => e.scheduledTimeStart <= best.scheduledPickupTimeStart)
			: events.find((e) => e.id === best.prevPickupId);
	if (prevEventInOtherTour === undefined) {
		prevEventInOtherTour = vehicle.lastEventBefore;
	}
	let nextEventInOtherTour =
		best.pickupCase.how == InsertHow.NEW_TOUR
			? events.find((e) => e.scheduledTimeEnd >= best.scheduledDropoffTimeEnd)
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
		best,
		prevPickupEvent,
		nextPickupEvent,
		nextDropoffEvent,
		prevDropoffEvent,
		firstEvents,
		lastEvents,
		pickupEventGroup,
		dropoffEventGroup,
		directDurations
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

	const additionalScheduledTimes = new Array<{ event_id: number; time: number; start: boolean }>();
	scheduledTimes.updates.forEach((update) => {
		const firstIdx = events.findIndex((e) => e.id === update.event_id);
		const lastIdx = events.findLastIndex((e) => e.id === update.event_id);
		const sameEventGroup = events.slice(firstIdx, lastIdx + 1);
		sameEventGroup.forEach((event) => {
			if (event.id === update.event_id) {
				return;
			}
			additionalScheduledTimes.push({ ...update, event_id: event.id });
		});
	});
	scheduledTimes.updates = scheduledTimes.updates.concat(additionalScheduledTimes);
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
			prevPickupGroup:
				best.pickupCase.how == InsertHow.PREPEND ? undefined : prevPickupEvent?.eventGroupId,
			nextPickup: best.pickupCase.how == InsertHow.APPEND ? undefined : nextPickupEvent?.id,
			nextPickupGroup:
				best.pickupCase.how == InsertHow.APPEND ? undefined : nextPickupEvent?.eventGroupId,
			prevDropoff: best.dropoffCase.how == InsertHow.PREPEND ? undefined : prevDropoffEvent?.id,
			prevDropoffGroup:
				best.dropoffCase.how == InsertHow.PREPEND ? undefined : prevDropoffEvent?.eventGroupId,
			nextDropoff: best.dropoffCase.how == InsertHow.APPEND ? undefined : nextDropoffEvent?.id,
			nextDropoffGroup:
				best.dropoffCase.how == InsertHow.APPEND ? undefined : nextDropoffEvent?.eventGroupId
		},
		directDurations,
		prevLegDurations,
		nextLegDurations,
		scheduledTimes,
		pickupEventGroup,
		dropoffEventGroup
	};
}

export type BookRideResponse = {
	best: Insertion;
	tour: undefined | number;
	mergeTourList: number[];
	neighbourIds: NeighbourIds;
	directDurations: DirectDrivingDurations;
	prevLegDurations: { event: number; duration: number | null }[];
	nextLegDurations: { event: number; duration: number | null }[];
	scheduledTimes: ScheduledTimes;
	pickupEventGroup: number | undefined;
	dropoffEventGroup: number | undefined;
};

function belongToSameEventGroup(
	event: Event | undefined,
	otherEventCoordinates: Coordinates,
	otherEventInterval: Interval
) {
	return (
		event !== undefined &&
		isSamePlace(event, otherEventCoordinates) &&
		(otherEventInterval.overlaps(event.time) ||
			otherEventInterval.touches(event.time) ||
			otherEventInterval.equals(event.time))
	);
}
