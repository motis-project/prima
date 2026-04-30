import type { Coordinates } from '$lib/util/Coordinates';
import { db, type Database } from '$lib/server/db';
import { getScheduledTimeBufferDropoff } from '$lib/util/getScheduledTimeBuffer';
import { MAX_RIDE_SHARE_TOUR_TIME, SCHEDULED_TIME_BUFFER_PICKUP } from '$lib/constants';
import { Interval } from '$lib/util/interval';
import { MINUTE } from '$lib/util/time';
import { oneToManyCarRouting } from '$lib/server/util/oneToManyCarRouting';
import { sendMail } from '$lib/server/sendMail';
import { sendDesiredTripMails } from './sendDesiredTripMails';
import type { Transaction } from 'kysely';

export async function getRideShareTourCommunicatedTimes(
	time: number,
	startFixed: boolean,
	vehicle: number,
	start: Coordinates,
	target: Coordinates,
	checkConflicts?: boolean
) {
	const r = await util([time], startFixed, vehicle, start, target, checkConflicts);
	return r[0] === undefined ? undefined : { start: r[0].startTimeStart, end: r[0].targetTimeEnd };
}

async function util(
	times: number[],
	startFixed: boolean,
	vehicle: number,
	start: Coordinates,
	target: Coordinates,
	checkConflicts: boolean = true
): Promise<
	(
		| {
				startTimeStart: number;
				startTimeEnd: number;
				targetTimeStart: number;
				targetTimeEnd: number;
				duration: number;
		  }
		| undefined
	)[]
> {
	const duration = (await oneToManyCarRouting(start, [target], false, MAX_RIDE_SHARE_TOUR_TIME))[0];
	if (!duration) {
		console.log('adding tour: routing failed');
		return Array.from(times, (_) => undefined);
	}
	const results = [];
	for (const time of times) {
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

		const otherTourEvents = checkConflicts
			? await db
					.selectFrom('rideShareTour')
					.innerJoin('request', 'rideShareTour.id', 'request.rideShareTour')
					.innerJoin('event', 'event.request', 'request.id')
					.innerJoin('eventGroup', 'event.eventGroupId', 'eventGroup.id')
					.where(
						'eventGroup.scheduledTimeStart',
						'>',
						dayStart.getTime() - 2 * MAX_RIDE_SHARE_TOUR_TIME
					)
					.where(
						'eventGroup.scheduledTimeStart',
						'<',
						dayEnd.getTime() + 2 * MAX_RIDE_SHARE_TOUR_TIME
					)
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
					.execute()
			: [];
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
			const prevLegDurationResult = (await oneToManyCarRouting(lastTourEvent, [start], false))[0];
			if (!prevLegDurationResult) {
				console.log('adding tour: previous leg conflict', prevLegDurationResult, lastEventBefore);
				results.push(undefined);
				continue;
			}
			allowedIntervals = Interval.subtract(allowedIntervals, [
				new Interval(firstTourEvent.scheduledTimeStart, lastTourEvent.scheduledTimeEnd).expand(
					0,
					prevLegDurationResult
				)
			]);
		}
		if (firstEventAfter !== null) {
			const sameTourEvents = otherTourEvents
				.filter((e) => e.tourId === firstEventAfter.tourId)
				.sort((e1, e2) => e1.scheduledTimeStart - e2.scheduledTimeStart);
			const firstTourEvent = sameTourEvents[0];
			const lastTourEvent = sameTourEvents[sameTourEvents.length - 1];
			const nextLegDurationResult = (await oneToManyCarRouting(target, [firstTourEvent], false))[0];
			if (!nextLegDurationResult) {
				console.log('adding tour: next leg conflict', nextLegDurationResult, firstEventAfter);
				results.push(undefined);
				continue;
			}
			allowedIntervals = Interval.subtract(allowedIntervals, [
				new Interval(firstTourEvent.scheduledTimeStart, lastTourEvent.scheduledTimeEnd).expand(
					nextLegDurationResult,
					0
				)
			]);
		}
		allowedIntervals = allowedIntervals.filter(
			(i) => i.size() >= duration && allowedArrivalsAtFixed.overlaps(i)
		);
		if (allowedIntervals.length === 0) {
			console.log('adding tour: allowed intervals conflict', allowedIntervals);
			results.push(undefined);
			continue;
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
		results.push({
			startTimeStart: startTimeShifted,
			startTimeEnd: startTime,
			targetTimeStart: targetTime,
			targetTimeEnd: targetTimeShifted,
			duration
		});
	}
	return results;
}

export const addRideShareTour = async (
	times: number[],
	startFixed: boolean,
	passengers: number,
	luggage: number,
	provider: number,
	vehicle: number,
	start: Coordinates,
	target: Coordinates,
	startAddress = '',
	targetAddress = '',
	trx?: Transaction<Database>,
	days?: number,
	rangeStart?: string,
	rangeEnd?: string
): Promise<number | undefined> => {
	console.log(
		'ADD RIDE SHARE TOUR PARAMS: ',
		JSON.stringify({
			times,
			startFixed,
			passengers,
			luggage,
			provider,
			vehicle,
			start,
			target,
			startAddress,
			targetAddress
		})
	);
	let patternId: number | undefined = undefined;
	if (times.length !== 1) {
		patternId = (
			await (trx ?? db)
				.insertInto('repeatPattern')
				.values({
					days: days!,
					rangeStart: rangeStart!,
					rangeEnd: rangeEnd!
				})
				.returning('id')
				.executeTakeFirstOrThrow()
		).id;
	}
	const timesResults = await util(times, startFixed, vehicle, start, target);
	if (timesResults.length === 1 && timesResults[0] === undefined) {
		return undefined;
	}
	const tourIds = [];
	for (const timesResult of timesResults) {
		if (timesResult === undefined) {
			tourIds.push(undefined);
			continue;
		}
		const { startTimeStart, startTimeEnd, targetTimeStart, targetTimeEnd, duration } = timesResult;
		const tourId = (
			await (trx ?? db)
				.insertInto('rideShareTour')
				.values({
					passengers,
					luggage,
					cancelled: false,
					vehicle,
					earliestStart: startTimeStart,
					communicatedStart: startTimeStart,
					latestEnd: targetTimeEnd,
					communicatedEnd: targetTimeEnd,
					pattern: patternId ?? null
				})
				.returning('id')
				.executeTakeFirstOrThrow()
		).id;
		const requestId = (
			await (trx ?? db)
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
					pending: false,
					cancelledByCustomer: false
				})
				.returning('id')
				.execute()
		)[0].id;
		const eventGroupPickup = (
			await (trx ?? db)
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
		await (trx ?? db)
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
			await (trx ?? db)
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
		await (trx ?? db)
			.insertInto('event')
			.values({
				isPickup: false,
				communicatedTime: targetTimeEnd,
				request: requestId,
				cancelled: false,
				eventGroupId: eventGroupDropoff
			})
			.execute();
		sendDesiredTripMails(
			start,
			target,
			startTimeStart,
			targetTimeEnd,
			sendMail,
			startFixed,
			tourId
		).catch((err) => console.error('matchDesiredTrips failed:', err));
		tourIds.push(tourId);
	}
	return tourIds.some((t) => t !== undefined) ? tourIds[0] : undefined;
};
