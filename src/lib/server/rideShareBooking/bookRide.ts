import type { Transaction } from 'kysely';
import type { Capacities } from '$lib/util/booking/Capacities';
import type { Database } from '$lib/server/db';
import { Interval } from '$lib/util/interval';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';
import { type RideShareEvent } from '$lib/server/rideShareBooking/getRideShareTours';
import type { Coordinates } from '$lib/util/Coordinates';
import { InsertWhat } from '$lib/util/booking/insertionTypes';
import { DAY } from '$lib/util/time';
import { getRideShareTours } from './getRideShareTours';
import { getScheduledTimes, type ScheduledTimes } from './getScheduledTimes';
import { getLegDurationUpdates } from './getLegDurationUpdates';
import type { Insertion, NeighbourIds } from './insertion';
import { isSamePlace } from '../booking/isSamePlace';
import { evaluateRequest } from './evaluateRequest';
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

export async function bookSharedRide(
	c: ExpectedConnection,
	required: Capacities,
	trx?: Transaction<Database>,
	skipPromiseCheck?: boolean,
	blockedProviderId?: number
): Promise<undefined | BookRideShareResponse> {
	console.log('BS');
	const searchInterval = new Interval(c.startTime, c.targetTime);
	const expandedSearchInterval = searchInterval.expand(DAY, DAY);
	const userChosen = !c.startFixed ? c.start : c.target;
	const busStop = c.startFixed ? c.start : c.target;
	const rideShareTours = await getRideShareTours(required, expandedSearchInterval, trx);
	if (rideShareTours.length == 0) {
		console.log('there were no ride shares tours which could be concatenated with this request.');
		return undefined;
	}
	const allowedRideShareTours = rideShareTours.filter((t) => t.provider !== blockedProviderId);
	const best = (
		await evaluateRequest(
			allowedRideShareTours,
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
	console.log({ best });
	const rideShareTour = allowedRideShareTours.find((t) => best.tour === t.rideShareTour)!;
	const events: RideShareEvent[] = rideShareTour.events;
	console.log('BE');
	const prevPickupEvent = events[best.pickupIdx - 1];
	const nextPickupEvent =
		InsertWhat.BOTH === best.pickupCase.what ? undefined : events[best.pickupIdx];
	const prevDropoffEvent =
		InsertWhat.BOTH === best.pickupCase.what ? undefined : events[best.dropoffIdx - 1];
	const nextDropoffEvent = events[best.dropoffIdx];
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
		prevPickupEvent,
		nextPickupEvent,
		prevDropoffEvent,
		nextDropoffEvent,
		pickupEventGroup,
		dropoffEventGroup,
		best
	);
	const scheduledTimes = getScheduledTimes(
		best,
		prevPickupEvent,
		nextPickupEvent,
		nextDropoffEvent,
		prevDropoffEvent,
		pickupEventGroup,
		dropoffEventGroup
	);

	const additionalScheduledTimes = new Array<{ event_id: number; time: number; start: boolean }>();
	scheduledTimes.updates.forEach((update) => {
		const firstIdx = events.findIndex((e) => e.eventId === update.event_id);
		const lastIdx = events.findLastIndex((e) => e.eventId === update.event_id);
		const sameEventGroup = events.slice(firstIdx, lastIdx + 1);
		sameEventGroup.forEach((event) => {
			if (event.eventId === update.event_id) {
				return;
			}
			additionalScheduledTimes.push({ ...update, event_id: event.eventId });
		});
	});
	scheduledTimes.updates = scheduledTimes.updates.concat(additionalScheduledTimes);
	return {
		best,
		tour: prevPickupEvent.tourId,
		neighbourIds: {
			prevPickup: prevPickupEvent.eventId,
			prevPickupGroup: prevPickupEvent.eventGroupId,
			nextPickup: nextPickupEvent?.eventId,
			nextPickupGroup: nextPickupEvent?.eventGroupId,
			prevDropoff: prevDropoffEvent?.eventId,
			prevDropoffGroup: prevDropoffEvent?.eventGroupId,
			nextDropoff: nextDropoffEvent.eventId,
			nextDropoffGroup: nextDropoffEvent.eventGroupId
		},
		prevLegDurations,
		nextLegDurations,
		scheduledTimes,
		pickupEventGroup,
		dropoffEventGroup
	};
}

export type BookRideShareResponse = {
	best: Insertion;
	tour: undefined | number;
	neighbourIds: NeighbourIds;
	prevLegDurations: { event: number; duration: number | null }[];
	nextLegDurations: { event: number; duration: number | null }[];
	scheduledTimes: ScheduledTimes;
	pickupEventGroup: number | undefined;
	dropoffEventGroup: number | undefined;
};

function belongToSameEventGroup(
	event: RideShareEvent | undefined,
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
