import type { Transaction } from 'kysely';
import type { Capacities } from '$lib/util/booking/Capacities';
import type { Database } from '$lib/server/db';
import { Interval } from '$lib/util/interval';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';
import { type RideShareEvent } from '$lib/server/booking/rideShare/getRideShareTours';
import type { Coordinates } from '$lib/util/Coordinates';
import { InsertWhat } from '$lib/util/booking/insertionTypes';
import { DAY } from '$lib/util/time';
import { getRideShareTours } from './getRideShareTours';
import type { Insertion, NeighbourIds } from './insertion';
import { evaluateRequest } from './evaluateRequest';
import type { Mode } from '../mode';
export type ExpectedConnection = {
	start: Coordinates;
	target: Coordinates;
	startTime: UnixtimeMs;
	targetTime: UnixtimeMs;
	signature: string;
	startFixed: boolean;
	requestedTime: UnixtimeMs;
	tourId: number;
	mode: Mode;
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
	const allowedRideShareTours = rideShareTours.filter((t) => t.owner !== blockedProviderId);
	const result = (
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
	const best = result.sort((r1, r2) => r2.profit - r1.profit)[0];
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
		}
	};
}

export type BookRideShareResponse = {
	best: Insertion;
	tour: undefined | number;
	neighbourIds: NeighbourIds;
};
