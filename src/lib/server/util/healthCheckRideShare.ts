import { Interval } from '../../util/interval';
import { isSamePlace } from '../booking/isSamePlace';
import { SCHEDULED_TIME_BUFFER_PICKUP } from '$lib/constants';
import { sortEventsByTime } from '$lib/testHelpers';
import { reverseGeo } from '$lib/server/util/reverseGeocode';
import { getScheduledTimeBufferDropoff } from '$lib/util/getScheduledTimeBuffer';
import {
	getRideShareTours,
	type RideShareToursWithRequests,
	type RideShareTourWithRequestsEvent
} from './getRideShareTours';

function validateRequestHas2Events(tours: RideShareToursWithRequests): boolean {
	let fail = false;
	for (const tour of tours) {
		for (const request of tour.requests) {
			const events = request.events;
			const requestId = request.requestId;
			if (events.length !== 2) {
				console.log(
					`Invalid tour: ${tour.tourId} - Request ID: ${requestId} does not have 2 events.`
				);
				for (const event of events) {
					console.log(`  Invalid Event ID: ${event.id}`);
				}
				fail = true;
				break;
			}

			let isPickupFound = false;
			let isDropoffFound = false;

			for (const event of events) {
				if (event.isPickup) {
					isPickupFound = true;
				} else {
					isDropoffFound = true;
				}
			}

			if (!(isPickupFound && isDropoffFound)) {
				console.log(
					`Invalid tour: ${tour.tourId} - Request ID: ${requestId} does not have both pickup and dropoff.`
				);
				for (const event of events) {
					console.log(`  Invalid Event ID: ${event.id}`);
				}
				fail = true;
				break;
			}
		}
	}
	return fail;
}

function validateToursWithNoEvents(tours: RideShareToursWithRequests): boolean {
	let fail = false;
	console.log('Validating tours with no events...');
	for (const request of tours.flatMap((t) => t.requests)) {
		if (request.events.length === 0) {
			console.log(`Request ${request.requestId} has no associated events.`);
			fail = true;
		}
	}
	for (const tour of tours) {
		if (tour.requests.length === 0) {
			console.log(`Tour ${tour.tourId} has no associated requests.`);
			fail = true;
		}
	}
	return fail;
}

function validateTourAndRequestCancelled(tours: RideShareToursWithRequests): boolean {
	let fail = false;
	console.log('Validating tour and request cancellation consistency...');
	for (const tour of tours) {
		let allRequestsCancelled = true;
		for (const event of tour.requests.flatMap((r) => r.events)) {
			if (
				(event.cancelled && !event.requestCancelled) ||
				(!event.cancelled && event.requestCancelled)
			) {
				console.log(`event and request cancelled fields do not match for event_id ${event.id}`);
				fail = true;
			}
			if (!event.requestCancelled) {
				allRequestsCancelled = false;
				if (tour.cancelled) {
					console.log(
						`tour was cancelled but associated request isn't for request_id ${event.requestId}`
					);
					fail = true;
				}
			}
		}
		if (allRequestsCancelled && !tour.cancelled && tour.requests.length > 0) {
			console.log(
				`all requests are cancelled but associated tour isn't for tour_id ${tour.tourId}`
			);
			fail = true;
		}
	}
	return fail;
}

function validateEventParameters(tours: RideShareToursWithRequests): boolean {
	let fail = false;
	console.log('Validating event parameters...');
	for (const tour of tours) {
		for (const request of tour.requests) {
			const passengers = request.passengers || 0;
			const luggage = request.luggage || 0;
			if (request.isInitial) {
				continue;
			}
			if (passengers <= 0) {
				console.log(
					`Invalid passengers value for requestId ${request.requestId}: ${passengers}. It should be positive.`
				);
				fail = true;
			}
			if (luggage < 0) {
				console.log(
					`Invalid luggage value for requestId ${request.requestId}: ${luggage}. It should be non-negative.`
				);
				fail = true;
			}
		}
	}
	return fail;
}

function validateEventTimeNoOverlap(tours: RideShareToursWithRequests): boolean {
	let fail = false;
	console.log('Validating that events do not overlap more than a single point...');
	function overlaps(
		event1: RideShareTourWithRequestsEvent,
		event2: RideShareTourWithRequestsEvent
	): boolean {
		const start1 = event1.scheduledTimeStart;
		const end1 = event1.scheduledTimeEnd;
		const start2 = event2.scheduledTimeStart;
		const end2 = event2.scheduledTimeEnd;
		return start1 < end2 && start2 < end1;
	}

	for (const [tourId1, tour] of tours.entries()) {
		const events = tour.requests.flatMap((r) => r.events.filter((e) => !e.requestCancelled));
		for (let i = 0; i < events.length; i++) {
			for (let j = i + 1; j < events.length; j++) {
				const event1 = events[i];
				const event2 = events[j];

				if (
					overlaps(event1, event2) &&
					!(
						isSamePlace(event1, event2) &&
						event1.scheduledTimeEnd === event2.scheduledTimeEnd &&
						event1.scheduledTimeStart === event2.scheduledTimeStart
					)
				) {
					console.log(
						`Overlap detected between eventId ${event1.id} and eventId ${event2.id}, ${new Interval(event1.scheduledTimeStart, event1.scheduledTimeEnd).toString()} and ${new Interval(event2.scheduledTimeStart, event2.scheduledTimeEnd).toString()}`
					);
					fail = true;
				}
			}
		}
		for (let tourId2 = tourId1 + 1; tourId2 != tours.length; ++tourId2) {
			const tour2 = tours[tourId2];
			const i1 = new Interval(tour.startTime, tour.endTime);
			const i2 = new Interval(tour2.startTime, tour2.endTime);
			if (i1.overlaps(i2) && tour.vehicleId === tour2.vehicleId) {
				console.log(
					`tour overlap detected between tourId ${tour.tourId} and tourId ${tour2.tourId} tourInterval1: ${i1.toString()}, tourInterval2: ${i2.toString()}`
				);
				fail = true;
			}
		}
	}
	return fail;
}

function validateEventsAreInsideTours(tours: RideShareToursWithRequests): boolean {
	let fail = false;
	console.log('Validating that all events of a tour happen inside of departure-arrival...');
	for (const tour of tours) {
		const tourInterval = new Interval(tour.startTime, tour.endTime);
		for (const event of tour.requests.flatMap((r) => r.events)) {
			const eventInterval = new Interval(event.scheduledTimeStart, event.scheduledTimeEnd);
			if (!tourInterval.noDistanceBetween(eventInterval)) {
				console.log(
					`event with id: ${event.id} is outside of its' tour. tourInterval: ${tourInterval.toString()}, eventScheduledInterval: ${eventInterval.toString()}`
				);
				fail = true;
			}
		}
	}
	return fail;
}

async function oneToMany(
	fromLat: number,
	fromLng: number,
	toLat: number,
	toLng: number,
	arriveBy?: boolean
): Promise<number | null> {
	const baseUrl = 'http://localhost:6499';
	const params = new URLSearchParams({
		arriveBy: arriveBy ? 'true' : 'false',
		many: `${toLat};${toLng}`,
		max: '3600',
		maxMatchingDistance: '250',
		mode: 'CAR',
		one: `${fromLat};${fromLng}`
	});

	try {
		const response = await fetch(`${baseUrl}/api/v1/one-to-many?${params.toString()}`);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		if (data?.length === 0) {
			console.log('Error with oneToMany api call. ', { response });
		}
		return data[0].duration;
	} catch (error) {
		console.error(`Error with one-to-many API: ${error}`);
		return null;
	}
}

function validateScheduledTimeStartBeforeEnd(tours: RideShareToursWithRequests): boolean {
	let fail = false;
	console.log('Validating scheduledTimeEnd not before scheduledTimeStart...');
	for (const event of tours.flatMap((t) => t.requests.flatMap((r) => r.events))) {
		if (event.scheduledTimeEnd < event.scheduledTimeStart) {
			console.log(
				'Found an event where scheduledTimeEnd is before scheduledTimeStart, eventId: ',
				event.id
			);
			fail = true;
		}
	}
	return fail;
}

function validateScheduledIntervalSize(tours: RideShareToursWithRequests): boolean {
	let fail = false;
	console.log('Validating scheduled time intervals are not growing...');
	for (const request of tours.flatMap((t) => t.requests)) {
		if (request.events.length !== 2) {
			console.log('Found a request with not exactly 2 events requestId: ', request.requestId);
		}
		const pickup = request.events.find((e) => e.isPickup)!;
		const dropoff = request.events.find((e) => !e.isPickup)!;
		const durationApprox = dropoff.scheduledTimeStart - pickup.scheduledTimeEnd;
		const bufferUpperBound = getScheduledTimeBufferDropoff(durationApprox);
		if (pickup.scheduledTimeEnd - pickup.scheduledTimeStart > SCHEDULED_TIME_BUFFER_PICKUP) {
			console.log('Found an event where the scheduled time interval grew, eventId: ', pickup.id);
			fail = true;
		}
		if (dropoff.scheduledTimeEnd - dropoff.scheduledTimeStart > bufferUpperBound) {
			console.log('Found an event where the scheduled time interval grew, eventId: ', dropoff.id);
			fail = true;
		}
	}
	return fail;
}

async function validateLegDurations(tours: RideShareToursWithRequests): Promise<boolean> {
	let fail = false;
	console.log('Validating leg durations...');
	for (const tour of tours) {
		const events = sortEventsByTime([...tour.requests.flatMap((r) => r.events)]);
		const expected1: Promise<number | null>[] = [];
		const expected2: Promise<number | null>[] = [];
		for (let i = 0; i < events.length - 1; i++) {
			const earlierEvent = events[i];
			const laterEvent = events[i + 1];
			expected1.push(oneToMany(earlierEvent.lat, earlierEvent.lng, laterEvent.lat, laterEvent.lng));
			expected2.push(
				oneToMany(laterEvent.lat, laterEvent.lng, earlierEvent.lat, earlierEvent.lng, true)
			);
		}
		const expectedDurations1 = await Promise.all(expected1);
		const expectedDurations2 = await Promise.all(expected2);
		for (let i = 0; i < events.length - 1; i++) {
			const earlierEvent = events[i];
			const laterEvent = events[i + 1];
			if (earlierEvent.eventGroupId === laterEvent.eventGroupId) {
				continue;
			}
			if (earlierEvent.nextLegDuration !== laterEvent.prevLegDuration) {
				console.log(
					`Leg duration mismatch between events ${earlierEvent.id} and ${laterEvent.id}, durations: ${earlierEvent.nextLegDuration / 1000} and ${laterEvent.prevLegDuration / 1000} routing results: ${expectedDurations1[i]} and ${expectedDurations2[i]}`
				);
				fail = true;
			}
			const expectedDuration = expectedDurations1[i];
			const expectedDuration2 = expectedDurations2[i];
			if (
				expectedDuration !== null &&
				(isSamePlace(earlierEvent, laterEvent)
					? 0
					: expectedDuration + (earlierEvent.isInitial ? 0 : 60)) >
					earlierEvent.nextLegDuration / 1000 &&
				expectedDuration2 !== null &&
				(isSamePlace(earlierEvent, laterEvent)
					? 0
					: expectedDuration2 + (earlierEvent.isInitial ? 0 : 60)) >
					earlierEvent.nextLegDuration / 1000
			) {
				console.log(
					`Earlier event is ${earlierEvent.isInitial ? '' : 'not '}initial. Direct duration mismatch for events ${earlierEvent.id} -> ${laterEvent.id}: \
              Expected ${expectedDuration + (earlierEvent.isInitial ? 0 : 60)} or ${expectedDuration2 + (earlierEvent.isInitial ? 0 : 60)} seconds, Found ${earlierEvent.nextLegDuration / 1000} and ${laterEvent.prevLegDuration / 1000} seconds`,
					{
						startTimes: events.map(
							(e) => `id: ${e.id} ${new Date(e.scheduledTimeStart).toISOString()}`
						)
					},
					{
						endTimes: events.map((e) => `id: ${e.id} ${new Date(e.scheduledTimeEnd).toISOString()}`)
					},
					{
						idsStart: sortEventsByTime(events).map((e) => e.id)
					},
					{
						idsEnd: sortEventsByTime(events).map((e) => e.id)
					}
				);
				fail = true;
			}
			const earlierEventEnd = earlierEvent.scheduledTimeEnd;
			const laterEventStart = laterEvent.scheduledTimeStart;
			const timeDiff = isSamePlace(earlierEvent, laterEvent)
				? 0
				: (laterEventStart - earlierEventEnd) / 1000;
			if (
				expectedDuration !== null &&
				timeDiff <
					(isSamePlace(earlierEvent, laterEvent)
						? 0
						: expectedDuration + (earlierEvent.isInitial ? 0 : 60)) &&
				expectedDuration2 !== null &&
				timeDiff <
					(isSamePlace(earlierEvent, laterEvent)
						? 0
						: expectedDuration2 + (earlierEvent.isInitial ? 0 : 60))
			) {
				console.log(
					`ealier event is ${earlierEvent.isInitial ? '' : 'not '}initial. Time difference expected duration ${expectedDuration + (earlierEvent.isInitial ? 0 : 60)} seconds exceeds difference in event times ${timeDiff} seconds for event_id ${earlierEvent.id} and event_id ${laterEvent.id} ${new Date(earlierEvent.scheduledTimeEnd).toISOString()} to ${new Date(laterEvent.scheduledTimeStart).toISOString()}`
				);
				fail = true;
			}
		}
	}
	return fail;
}

async function validateAddressCoordinatesMatch(tours: RideShareToursWithRequests) {
	console.log('Validating that addresses match coordinates...');
	for (const event of tours.flatMap((t) => t.requests.flatMap((r) => r.events))) {
		const reverseGeoResult = await reverseGeo(event);
		if (event.address !== reverseGeoResult) {
			console.log('Address does not match for event with id: ', event.id, { reverseGeoResult });
		}
	}
	return false;
}

export async function healthCheck() {
	const allTours: RideShareToursWithRequests = await getRideShareTours(true);
	const uncancelledTours: RideShareToursWithRequests = await getRideShareTours(false);
	const acceptedTours: RideShareToursWithRequests = await getRideShareTours(false, false);
	let fail = false;
	if (allTours) {
		console.log('Starting ride share health check');
		console.log('Validating ride share tours...');
		fail = validateRequestHas2Events(uncancelledTours) ? true : fail;
		fail = validateToursWithNoEvents(uncancelledTours) ? true : fail;
		fail = validateTourAndRequestCancelled(allTours) ? true : fail;
		fail = validateEventParameters(uncancelledTours) ? true : fail;
		fail = validateEventTimeNoOverlap(acceptedTours) ? true : fail;
		fail = validateEventsAreInsideTours(uncancelledTours) ? true : fail;
		fail = validateScheduledTimeStartBeforeEnd(uncancelledTours) ? true : fail;
		fail = validateScheduledIntervalSize(uncancelledTours) ? true : fail;
		fail = (await validateLegDurations(acceptedTours)) ? true : fail;
		fail = (await validateAddressCoordinatesMatch(allTours)) ? true : fail;
		console.log('Finished ride share health chcek');
	} else {
		console.log('No tours found or there was an error fetching the data.');
	}
	return fail;
}
