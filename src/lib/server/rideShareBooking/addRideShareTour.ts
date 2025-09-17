import type { Coordinates } from '$lib/util/Coordinates';
import { db } from '../db';
import { oneToManyCarRouting } from '../util/oneToManyCarRouting';
import { getScheduledTimeBufferDropoff } from '$lib/util/getScheduledTimeBuffer';
import { SCHEDULED_TIME_BUFFER_PICKUP } from '$lib/constants';

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

	const startTimeShifted = startTime - SCHEDULED_TIME_BUFFER_PICKUP;
	const endTimeShifted = endTime + getScheduledTimeBufferDropoff(endTime - startTime);
	const tourId = (
		await db
			.insertInto('rideShareTour')
			.values({
				passengers,
				luggage,
				fare: null,
				cancelled: false,
				message: null,
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
