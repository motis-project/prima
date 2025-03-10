import type { Transaction } from 'kysely';
import type { Capacities } from '$lib/server/booking/Capacities';
import type { Database } from '$lib/server/db';
import { Interval } from '$lib/server/util/interval';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';
import { MAX_TRAVEL } from '$lib/constants';
import { getBookingAvailability } from '$lib/server/booking/getBookingAvailability';
import type { Coordinates } from '$lib/util/Coordinates';
import { evaluateRequest } from '$lib/server/booking/evaluateRequest';
import { InsertHow } from '$lib/server/booking/insertionTypes';
import { getEventGroupInfo } from '$lib/server/booking/getEventGroupInfo';
import { getDirectDurations } from './getDirectDrivingDurations';
import { getMergeTourList } from './getMergeToorList';

export type ExpectedConnection = {
	start: Coordinates;
	target: Coordinates;
	startTime: UnixtimeMs;
	targetTime: UnixtimeMs;
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
	startFixed: boolean,
	trx?: Transaction<Database>,
	blockedVehicleId?: number
) {
	console.log('BS');
	const searchInterval = new Interval(c.startTime, c.targetTime);
	const expandedSearchInterval = searchInterval.expand(MAX_TRAVEL * 6, MAX_TRAVEL * 6);
	const userChosen = !startFixed ? c.start : c.target;
	const busStop = startFixed ? c.start : c.target;
	const { companies, filteredBusStops } = await getBookingAvailability(
		userChosen,
		required,
		searchInterval,
		[busStop],
		trx
	);
	if (companies.length == 0 || filteredBusStops[0] == undefined) {
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
	const busTime = startFixed ? c.startTime : c.targetTime;
	const best = (
		await evaluateRequest(
			companies,
			expandedSearchInterval,
			userChosen,
			[{ ...busStop, times: [busTime] }],
			required,
			startFixed
			//{
			//	pickup: c.startTime,
			//	dropoff: c.targetTime
			//}
		)
	)[0][0];
	if (best == undefined) {
		return undefined;
	}
	const events = companies[best.company].vehicles.find((v) => v.id == best.vehicle)!.events;
	let prevPickupEventIdx = best.pickupIdx == undefined ? undefined : best.pickupIdx - 1;
	if (best.pickupCase.how == InsertHow.NEW_TOUR) {
		prevPickupEventIdx = events.findLastIndex((e) => e.communicatedTime <= best.pickupTime);
	}
	const pickupEventGroupInfo = getEventGroupInfo(
		events,
		c.start,
		prevPickupEventIdx,
		best.pickupIdx,
		best.pickupCase.how
	);
	const prevDropoffEventIdx = best.dropoffIdx == undefined ? undefined : best.dropoffIdx - 1;
	const dropoffEventGroupInfo = getEventGroupInfo(
		events,
		c.target,
		prevDropoffEventIdx,
		best.dropoffIdx,
		best.dropoffCase.how
	);
	const prevEventIdxOtherTour =
		best.pickupCase.how == InsertHow.NEW_TOUR
			? events.findLastIndex((e) => e.communicatedTime <= best.pickupTime)
			: prevPickupEventIdx;
	const prevEventInOtherTour =
		prevEventIdxOtherTour == undefined || prevEventIdxOtherTour == -1
			? undefined
			: events[prevEventIdxOtherTour];
	const nextEventIdxOtherTour =
		best.pickupCase.how == InsertHow.NEW_TOUR
			? events.findIndex((e) => e.communicatedTime >= best.dropoffTime)
			: prevPickupEventIdx;
	const nextEventInOtherTour =
		nextEventIdxOtherTour == undefined || nextEventIdxOtherTour == -1
			? undefined
			: events[nextEventIdxOtherTour];
	const directDurations = await getDirectDurations(
		best,
		prevEventInOtherTour,
		nextEventInOtherTour,
		c,
		events[best.pickupIdx ?? -1]?.tourId
	);
	console.log('BE');
	const prevPickupEvent = best.pickupIdx == undefined ? undefined : events[best.pickupIdx - 1];
	const nextPickupEvent = best.pickupIdx == undefined ? undefined : events[best.pickupIdx];
	const prevDropoffEvent = best.dropoffIdx == undefined ? undefined : events[best.dropoffIdx - 1];
	const nextDropoffEvent = best.dropoffIdx == undefined ? undefined : events[best.dropoffIdx];
	return {
		best,
		tour: (() => {
			switch (best.pickupCase.how) {
				case InsertHow.NEW_TOUR:
					return undefined;
				case InsertHow.PREPEND:
					return nextPickupEvent!.tourId;
				default:
					return prevPickupEvent!.tourId;
			}
		})(),
		mergeTourList: getMergeTourList(
			events,
			best.pickupCase.how,
			best.dropoffCase.how,
			best.pickupIdx,
			best.dropoffIdx
		),
		eventGroupUpdateList: pickupEventGroupInfo.updateList.concat(dropoffEventGroupInfo.updateList),
		pickupEventGroup: pickupEventGroupInfo.newEventGroup,
		dropoffEventGroup: dropoffEventGroupInfo.newEventGroup,
		neighbourIds: {
			prevPickup: best.pickupCase.how == InsertHow.PREPEND ? undefined : prevPickupEvent?.id,
			nextPickup: best.pickupCase.how == InsertHow.APPEND ? undefined : nextPickupEvent?.id,
			prevDropoff: best.dropoffCase.how == InsertHow.PREPEND ? undefined : prevDropoffEvent?.id,
			nextDropoff: best.dropoffCase.how == InsertHow.APPEND ? undefined : nextDropoffEvent?.id
		},
		directDurations
	};
}
