import type { Coordinates } from '$lib/util/Coordinates';
import { db } from '../db';
import { oneToManyCarRouting } from '../util/oneToManyCarRouting';
import { getScheduledTimeBufferDropoff } from '$lib/util/getScheduledTimeBuffer';
import { SCHEDULED_TIME_BUFFER_PICKUP } from '$lib/constants';
import { Interval } from '$lib/util/interval';

export const addRideShareTour = async (
	time: number,
	startFixed: boolean,
	passengers: number,
	luggage: number,
	provider: number,
	start: Coordinates,
	target: Coordinates
): Promise<number> => {
	const duration = (await oneToManyCarRouting(start, [target], false))[0];
	if (duration === null || duration === undefined) {
		return -1;
	}
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
		.where('rideShareTour.provider', '=', provider)
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
		return -1;
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
		const prevLegDurationResult = await oneToManyCarRouting(lastEventBefore, [start], false);
		if (
			prevLegDurationResult.length === 0 ||
			prevLegDurationResult[0] === undefined ||
			newTourInterval.expand(prevLegDurationResult[0], 0).covers(lastEventBefore.scheduledTimeEnd)
		) {
			return -1;
		}
		prevLegDuration = prevLegDurationResult[0];
	}
	if (firstEventAfter !== null) {
		const nextLegDurationResult = await oneToManyCarRouting(target, [firstEventAfter], false);
		if (
			nextLegDurationResult.length === 0 ||
			nextLegDurationResult[0] === undefined ||
			newTourInterval.expand(0, nextLegDurationResult[0]).covers(firstEventAfter.scheduledTimeStart)
		) {
			return -1;
		}
		nextLegDuration = nextLegDurationResult[0];
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
	const tourId = (
		await db
			.insertInto('rideShareTour')
			.values({
				passengers,
				luggage,
				cancelled: false,
				provider
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
				scheduledTimeStart: startTimeShifted,
				scheduledTimeEnd: startTime,
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
			communicatedTime: startTimeShifted,
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
				scheduledTimeStart: endTime,
				scheduledTimeEnd: endTimeShifted,
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
			communicatedTime: endTimeShifted,
			request: requestId,
			cancelled: false,
			eventGroupId: eventGroupDropoff
		})
		.execute();
	return tourId;
};
