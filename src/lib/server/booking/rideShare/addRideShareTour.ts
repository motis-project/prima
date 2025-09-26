import type { Coordinates } from '$lib/util/Coordinates';
import { db } from '$lib/server/db';
import { getScheduledTimeBufferDropoff } from '$lib/util/getScheduledTimeBuffer';
import { SCHEDULED_TIME_BUFFER_PICKUP } from '$lib/constants';
import { Interval } from '$lib/util/interval';
import { carRouting } from '$lib/util/carRouting';

export async function getRideShareTourTimes(
	time: number,
	startFixed: boolean,
	vehicle: number,
	start: Coordinates,
	target: Coordinates
) {
	const r = await util(time, startFixed, vehicle, start, target);
	return r === undefined ? undefined : { start: r.startTimeStart, end: r.targetTimeEnd };
}

async function util(
	time: number,
	startFixed: boolean,
	vehicle: number,
	start: Coordinates,
	target: Coordinates
): Promise<
	| {
			startTimeStart: number;
			startTimeEnd: number;
			targetTimeStart: number;
			targetTimeEnd: number;
			duration: number;
	  }
	| undefined
> {
	const routingResult = (await carRouting(start, target)).direct;
	if (routingResult.length === 0) {
		return undefined;
	}
	const duration = routingResult[0].duration * 1000;
	const startTime = startFixed ? time : time - duration;
	const endTime = startFixed ? time + duration : time;
	const newTourInterval = new Interval(startTime, endTime);

	const dayStart = new Date(time);
	dayStart.setHours(0, 0, 0, 0);

	const dayEnd = new Date(dayStart);
	dayEnd.setDate(dayEnd.getDate() + 1);

	const otherTourEvents = await db
		.selectFrom('rideShareTour')
		.innerJoin('request', 'rideShareTour.id', 'request.rideShareTour')
		.innerJoin('event', 'event.request', 'request.id')
		.innerJoin('eventGroup', 'event.eventGroupId', 'event.id')
		.where('eventGroup.scheduledTimeStart', '>', dayStart.getTime())
		.where('eventGroup.scheduledTimeStart', '<', dayEnd.getTime())
		.where('rideShareTour.vehicle', '=', vehicle)
		.select([
			'eventGroup.scheduledTimeStart',
			'eventGroup.scheduledTimeEnd',
			'event.isPickup',
			'eventGroup.lat',
			'eventGroup.lng',
			'rideShareTour.id as tourId'
		])
		.execute();
	if (
		otherTourEvents.some((e) =>
			newTourInterval.overlaps(new Interval(e.scheduledTimeStart, e.scheduledTimeEnd))
		)
	) {
		return undefined;
	}
	const earlierEvents = otherTourEvents.filter((e) => e.scheduledTimeStart < startTime);
	const lastEventBefore =
		earlierEvents.length === 0
			? null
			: earlierEvents.reduce((max, curr) =>
					curr.scheduledTimeStart > max.scheduledTimeStart ? curr : max
				);
	const laterEvents = otherTourEvents.filter((e) => e.scheduledTimeStart >= startTime);
	const firstEventAfter =
		laterEvents.length === 0
			? null
			: laterEvents.reduce((min, curr) =>
					curr.scheduledTimeStart < min.scheduledTimeStart ? curr : min
				);
	let prevLegDuration = 0;
	let nextLegDuration = 0;
	if (lastEventBefore !== null) {
		const prevLegDurationResult = (await carRouting(lastEventBefore, start)).direct;
		if (
			prevLegDurationResult.length === 0 ||
			newTourInterval
				.expand(prevLegDurationResult[0].duration, 0)
				.covers(lastEventBefore.scheduledTimeEnd)
		) {
			return undefined;
		}
		prevLegDuration = prevLegDurationResult[0].duration * 1000;
	}
	if (firstEventAfter !== null) {
		const nextLegDurationResult = (await carRouting(target, firstEventAfter)).direct;
		if (
			nextLegDurationResult.length === 0 ||
			newTourInterval
				.expand(0, nextLegDurationResult[0].duration)
				.covers(firstEventAfter.scheduledTimeStart)
		) {
			return undefined;
		}
		nextLegDuration = nextLegDurationResult[0].duration * 1000;
	}
	const prevLegLeeway =
		lastEventBefore === null
			? Number.MAX_VALUE
			: startTime - prevLegDuration - lastEventBefore.scheduledTimeEnd;
	const nextLegLeeway =
		firstEventAfter === null
			? Number.MAX_VALUE
			: firstEventAfter.scheduledTimeStart - endTime - nextLegDuration;
	const startTimeShifted = startTime - Math.min(SCHEDULED_TIME_BUFFER_PICKUP, prevLegLeeway);
	const endTimeShifted =
		endTime + Math.min(getScheduledTimeBufferDropoff(endTime - startTime), nextLegLeeway);
	return {
		startTimeStart: startTimeShifted,
		startTimeEnd: startTime,
		targetTimeStart: endTime,
		targetTimeEnd: endTimeShifted,
		duration
	};
}

export const addRideShareTour = async (
	time: number,
	startFixed: boolean,
	passengers: number,
	luggage: number,
	provider: number,
	vehicle: number,
	start: Coordinates,
	target: Coordinates
): Promise<number | undefined> => {
	const timesResult = await util(time, startFixed, vehicle, start, target);
	if (timesResult === undefined) {
		return undefined;
	}
	const { startTimeStart, startTimeEnd, targetTimeStart, targetTimeEnd, duration } = timesResult;
	const tourId = (
		await db
			.insertInto('rideShareTour')
			.values({
				passengers,
				luggage,
				cancelled: false,
				vehicle,
				earliestStart: startTimeStart,
				communicatedStart: startTimeStart,
				latestEnd: targetTimeEnd,
				communicatedEnd: targetTimeEnd
			})
			.returning('id')
			.executeTakeFirstOrThrow()
	).id;
	const requestId = (
		await db
			.insertInto('request')
			.values({
				passengers: 0,
				kidsZeroToTwo: 0,
				kidsThreeToFour: 0,
				kidsFiveToSix: 0,
				wheelchairs: 0,
				bikes: 0,
				luggage: 0,
				tour: null,
				rideShareTour: tourId,
				customer: provider,
				ticketCode: '',
				ticketChecked: false,
				ticketPrice: 300,
				cancelled: false,
				pending: false
			})
			.returning('id')
			.execute()
	)[0].id;
	const eventGroupPickup = (
		await db
			.insertInto('eventGroup')
			.values({
				lat: start.lat,
				lng: start.lng,
				scheduledTimeStart: startTimeStart,
				scheduledTimeEnd: startTimeEnd,
				prevLegDuration: 0,
				nextLegDuration: duration,
				address: ''
			})
			.returning('id')
			.execute()
	)[0].id;
	await db
		.insertInto('event')
		.values({
			isPickup: true,
			communicatedTime: startTimeStart,
			request: requestId,
			cancelled: false,
			eventGroupId: eventGroupPickup
		})
		.execute();
	const eventGroupDropoff = (
		await db
			.insertInto('eventGroup')
			.values({
				lat: target.lat,
				lng: target.lng,
				scheduledTimeStart: targetTimeStart,
				scheduledTimeEnd: targetTimeEnd,
				prevLegDuration: duration,
				nextLegDuration: 0,
				address: ''
			})
			.returning('id')
			.execute()
	)[0].id;
	await db
		.insertInto('event')
		.values({
			isPickup: false,
			communicatedTime: targetTimeEnd,
			request: requestId,
			cancelled: false,
			eventGroupId: eventGroupDropoff
		})
		.execute();
	return tourId;
};
