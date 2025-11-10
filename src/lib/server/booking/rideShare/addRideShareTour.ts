import type { Coordinates } from '$lib/util/Coordinates';
import { db } from '$lib/server/db';
import { getScheduledTimeBufferDropoff } from '$lib/util/getScheduledTimeBuffer';
import { MAX_RIDE_SHARE_TOUR_TIME, SCHEDULED_TIME_BUFFER_PICKUP } from '$lib/constants';
import { Interval } from '$lib/util/interval';
import { carRouting } from '$lib/util/carRouting';
import { MINUTE } from '$lib/util/time';

export async function getRideShareTourCommunicatedTimes(
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
	const routingResult = (
		await carRouting(start, target, false, new Date().toISOString(), MAX_RIDE_SHARE_TOUR_TIME)
	).direct;
	if (routingResult.length === 0) {
		console.log('adding tour: routing failed');
		return undefined;
	}
	const duration = routingResult[0].duration * 1000;
	const allowedArrivalsAtFixed = new Interval(
		startFixed ? time : time - 10 * MINUTE,
		startFixed ? time + 10 * MINUTE : time
	);
	const fullCommunicatedDuration =
		SCHEDULED_TIME_BUFFER_PICKUP + (getScheduledTimeBufferDropoff(duration) + duration);
	const allowedArrivalsAtOther = allowedArrivalsAtFixed.shift(
		fullCommunicatedDuration * (startFixed ? 1 : -1)
	);
	const allowedArrivalsAtStart = startFixed ? allowedArrivalsAtFixed : allowedArrivalsAtOther;
	allowedArrivalsAtStart.startTime = Math.max(Date.now(), allowedArrivalsAtStart.startTime);
	const allowedArrivalsAtEnd = !startFixed ? allowedArrivalsAtFixed : allowedArrivalsAtOther;
	const fullTravelInterval = new Interval(
		allowedArrivalsAtStart.startTime,
		allowedArrivalsAtEnd.endTime
	);
	const dayStart = new Date(time);
	dayStart.setHours(0, 0, 0, 0);

	const dayEnd = new Date(dayStart);
	dayEnd.setDate(dayEnd.getDate() + 1);

	const otherTourEvents = await db
		.selectFrom('rideShareTour')
		.innerJoin('request', 'rideShareTour.id', 'request.rideShareTour')
		.innerJoin('event', 'event.request', 'request.id')
		.innerJoin('eventGroup', 'event.eventGroupId', 'eventGroup.id')
		.where('eventGroup.scheduledTimeStart', '>', dayStart.getTime())
		.where('eventGroup.scheduledTimeStart', '<', dayEnd.getTime())
		.where('rideShareTour.vehicle', '=', vehicle)
		.where('rideShareTour.cancelled', '=', false)
		.where('event.cancelled', '=', false)
		.where('request.cancelled', '=', false)
		.where('request.pending', '=', false)
		.select([
			'eventGroup.scheduledTimeStart',
			'eventGroup.scheduledTimeEnd',
			'event.isPickup',
			'eventGroup.lat',
			'eventGroup.lng',
			'rideShareTour.id as tourId',
			'event.id as eventId',
			'eventGroup.id as grp'
		])
		.execute();
	const splitTime = allowedArrivalsAtStart.startTime + duration / 2;
	const earlierEvents = otherTourEvents.filter((e) => e.scheduledTimeStart < splitTime);
	const lastEventBefore =
		earlierEvents.length === 0
			? null
			: earlierEvents.reduce((max, curr) =>
					curr.scheduledTimeStart > max.scheduledTimeStart ? curr : max
				);
	const laterEvents = otherTourEvents.filter((e) => e.scheduledTimeStart >= splitTime);
	const firstEventAfter =
		laterEvents.length === 0
			? null
			: laterEvents.reduce((min, curr) =>
					curr.scheduledTimeStart < min.scheduledTimeStart ? curr : min
				);
	let allowedIntervals = [fullTravelInterval];
	if (lastEventBefore !== null) {
		const sameTourEvents = otherTourEvents
			.filter((e) => e.tourId === lastEventBefore.tourId)
			.sort((e1, e2) => e1.scheduledTimeStart - e2.scheduledTimeStart);
		const firstTourEvent = sameTourEvents[0];
		const lastTourEvent = sameTourEvents[sameTourEvents.length - 1];
		const prevLegDurationResult = (await carRouting(lastTourEvent, start)).direct;
		if (prevLegDurationResult.length === 0) {
			console.log('adding tour: previous leg conflict', prevLegDurationResult, lastEventBefore);
			return undefined;
		}
		allowedIntervals = Interval.subtract(allowedIntervals, [
			new Interval(firstTourEvent.scheduledTimeStart, lastTourEvent.scheduledTimeEnd).expand(
				0,
				prevLegDurationResult[0].duration * 1000
			)
		]);
	}
	if (firstEventAfter !== null) {
		const sameTourEvents = otherTourEvents
			.filter((e) => e.tourId === firstEventAfter.tourId)
			.sort((e1, e2) => e1.scheduledTimeStart - e2.scheduledTimeStart);
		const firstTourEvent = sameTourEvents[0];
		const lastTourEvent = sameTourEvents[sameTourEvents.length - 1];
		const nextLegDurationResult = (await carRouting(target, firstTourEvent)).direct;
		if (nextLegDurationResult.length === 0) {
			console.log('adding tour: next leg conflict', nextLegDurationResult, firstEventAfter);
			return undefined;
		}
		allowedIntervals = Interval.subtract(allowedIntervals, [
			new Interval(firstTourEvent.scheduledTimeStart, lastTourEvent.scheduledTimeEnd).expand(
				nextLegDurationResult[0].duration * 1000,
				0
			)
		]);
	}
	allowedIntervals = allowedIntervals.filter(
		(i) => i.size() >= duration && allowedArrivalsAtFixed.overlaps(i)
	);
	if (allowedIntervals.length === 0) {
		console.log('adding tour: allowed intervals conflict', allowedIntervals);
		return undefined;
	}
	const bestInterval = allowedIntervals.reduce(
		(best, curr) =>
			(best = (startFixed ? best.startTime > curr.startTime : best.startTime < curr.startTime)
				? curr
				: best),
		allowedIntervals[0]
	);
	let startTime = -1;
	let targetTime = -1;
	let startTimeShifted = -1;
	let targetTimeShifted = -1;
	let leeway = bestInterval.size() - duration;
	if (startFixed) {
		startTimeShifted = bestInterval.startTime;
		startTime =
			startTimeShifted +
			Math.min(
				leeway,
				SCHEDULED_TIME_BUFFER_PICKUP,
				bestInterval.intersect(allowedArrivalsAtFixed)!.size()
			);
		leeway -= Math.min(leeway, SCHEDULED_TIME_BUFFER_PICKUP);
		targetTime = startTime + duration;
		targetTimeShifted = targetTime + Math.min(leeway, getScheduledTimeBufferDropoff(duration));
	} else {
		targetTimeShifted = bestInterval.endTime;
		targetTime =
			targetTimeShifted -
			Math.min(
				leeway,
				getScheduledTimeBufferDropoff(duration),
				bestInterval.intersect(allowedArrivalsAtFixed)!.size()
			);
		leeway -= Math.min(leeway, getScheduledTimeBufferDropoff(duration));
		startTime = targetTime - duration;
		startTimeShifted = startTime - Math.min(leeway, SCHEDULED_TIME_BUFFER_PICKUP);
	}
	return {
		startTimeStart: startTimeShifted,
		startTimeEnd: startTime,
		targetTimeStart: targetTime,
		targetTimeEnd: targetTimeShifted,
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
	target: Coordinates,
	startAddress = '',
	targetAddress = ''
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
				address: startAddress
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
				address: targetAddress
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
