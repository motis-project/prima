import { getToursWithRequests } from '../db/getTours';
import type { ToursWithRequests, TourWithRequestsEvent } from '$lib/util/getToursTypes';
import { groupBy } from '../../util/groupBy';
import { Interval } from '../../util/interval';
import { DAY, HOUR } from '../../util/time';
import { isSamePlace } from '../booking/isSamePlace';
import { SCHEDULED_TIME_BUFFER_PICKUP, PASSENGER_CHANGE_DURATION } from '$lib/constants';
import { sortEventsByTime } from '$lib/testHelpers';
import { reverseGeo } from '$lib/server/util/reverseGeocode';
import { getScheduledTimeBufferDropoff } from '$lib/util/getScheduledTimeBuffer';

function validateRequestHas2Events(tours: ToursWithRequests): boolean {
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

function validateToursWithNoEvents(tours: ToursWithRequests): boolean {
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

function validateTourAndRequestCancelled(tours: ToursWithRequests): boolean {
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

function validateEventParameters(tours: ToursWithRequests): boolean {
	let fail = false;
	console.log('Validating event parameters...');
	for (const tour of tours) {
		for (const request of tour.requests) {
			const passengers = request.passengers || 0;
			const wheelchairs = request.wheelchairs || 0;
			const bikes = request.bikes || 0;
			const luggage = request.luggage || 0;

			if (passengers <= 0) {
				console.log(
					`Invalid passengers value for requestId ${request.requestId}: ${passengers}. It should be positive.`
				);
				fail = true;
			}

			if (wheelchairs < 0) {
				console.log(
					`Invalid wheelchairs value for requestId ${request.requestId}: ${wheelchairs}. It should be non-negative.`
				);
				fail = true;
			}
			if (bikes < 0) {
				console.log(
					`Invalid bikes value for requestId ${request.requestId}: ${bikes}. It should be non-negative.`
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

function validateEventTimeNoOverlap(tours: ToursWithRequests): boolean {
	let fail = false;
	console.log('Validating that events do not overlap more than a single point...');
	function overlaps(event1: TourWithRequestsEvent, event2: TourWithRequestsEvent): boolean {
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

function validateEventsAreInsideTours(tours: ToursWithRequests): boolean {
	let fail = false;
	console.log('Validating that all events of a tour happen inside of departure-arrival...');
	for (const tour of tours) {
		const tourInterval = new Interval(tour.startTime, tour.endTime);
		for (const event of tour.requests.flatMap((r) => r.events)) {
			const eventInterval = new Interval(event.scheduledTimeStart, event.scheduledTimeEnd);
			if (!tourInterval.overlaps(eventInterval)) {
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

function validateScheduledTimeStartBeforeEnd(tours: ToursWithRequests): boolean {
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

function validateScheduledIntervalSize(tours: ToursWithRequests): boolean {
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

async function validateDirectDurations(tours: ToursWithRequests): Promise<boolean> {
	let fail = false;
	console.log('Validating direct durations...');
	const toursByVehicle = groupBy(
		tours.sort((a, b) => a.startTime - b.startTime),
		(t) => t.vehicleId,
		(t) => t
	);
	for (const [_, companyTours] of toursByVehicle) {
		for (let tourIdx = 1; tourIdx != companyTours.length; tourIdx++) {
			const earlierTour = companyTours[tourIdx - 1];
			const laterTour = companyTours[tourIdx];
			const earlierEvents = sortEventsByTime(earlierTour.requests.flatMap((r) => r.events));
			const laterEvents = sortEventsByTime(laterTour.requests.flatMap((r) => r.events));
			if (laterTour.vehicleId === earlierTour.vehicleId) {
				if (earlierTour.requests.length === 0) {
					console.log(`earlier tour has no requests`);
					fail = true;
					continue;
				}
				const e1 = earlierEvents[earlierEvents.length - 1];
				if (laterEvents.length === 0) {
					continue;
				}
				const e2 = laterEvents[0];
				const earlierTourEnd = earlierTour.endTime;
				const laterTourStart = laterTour.startTime;
				if (0 < laterTourStart - earlierTourEnd && laterTourStart - earlierTourEnd <= 3 * HOUR) {
					let expectedDuration = (await oneToMany(e1.lat, e1.lng, e2.lat, e2.lng)) ?? null;
					let expectedDuration2 = (await oneToMany(e2.lat, e2.lng, e1.lat, e1.lng, true)) ?? null;
					expectedDuration =
						expectedDuration === null ? null : expectedDuration + PASSENGER_CHANGE_DURATION / 1000;
					expectedDuration2 =
						expectedDuration2 === null
							? null
							: expectedDuration2 + PASSENGER_CHANGE_DURATION / 1000;
					if (
						expectedDuration === null &&
						expectedDuration2 === null &&
						laterTour.directDuration !== null
					) {
						console.log(
							`Found unexpected null in direct Duration for earlier tour: ${earlierTour.tourId} and later tour: ${laterTour.tourId}`
						);
						fail = true;
					}
					if (
						laterTour.directDuration === null &&
						expectedDuration !== null &&
						expectedDuration2 !== null
					) {
						console.log(
							`direct duration is null unexpectedly for earlier tour: ${earlierTour.tourId} and later tour: ${laterTour.tourId}, expected ${expectedDuration} or ${expectedDuration2} seconds`
						);
						fail = true;
					} else {
						if (
							laterTour.directDuration !== null &&
							expectedDuration !== null &&
							expectedDuration2 !== null &&
							Math.abs(expectedDuration - laterTour.directDuration / 1000) > 1 &&
							Math.abs(expectedDuration2 - laterTour.directDuration / 1000) > 1
						) {
							console.log(`Direct duration mismatch for earlier tour ${earlierTour.tourId} and later tour ${laterTour.tourId}: \
                  				Expected ${expectedDuration} or ${expectedDuration2} seconds, Found ${laterTour.directDuration / 1000} seconds, lat1: ${e1.lat} lng1:${e1.lng}, lat2: ${e2.lat} lng:${e2.lng} time difference: ${new Date(laterTourStart - earlierTourEnd).toISOString()}`);
							fail = true;
						}
					}
				}
			}
		}
	}
	return fail;
}

async function validateLegDurations(tours: ToursWithRequests): Promise<boolean> {
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
				(isSamePlace(earlierEvent, laterEvent) ? 0 : expectedDuration + 60) >
					earlierEvent.nextLegDuration / 1000 &&
				expectedDuration2 !== null &&
				(isSamePlace(earlierEvent, laterEvent) ? 0 : expectedDuration2 + 60) >
					earlierEvent.nextLegDuration / 1000
			) {
				console.log(
					`Direct duration mismatch for events ${earlierEvent.id} -> ${laterEvent.id}: \
              Expected ${expectedDuration + 60} or ${expectedDuration2 + 60} seconds, Found ${earlierEvent.nextLegDuration / 1000} and ${laterEvent.prevLegDuration / 1000} seconds`,
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
				timeDiff < (isSamePlace(earlierEvent, laterEvent) ? 0 : expectedDuration + 60) &&
				expectedDuration2 !== null &&
				timeDiff < (isSamePlace(earlierEvent, laterEvent) ? 0 : expectedDuration2 + 60)
			) {
				console.log(
					`Time difference expected duration ${expectedDuration + 60} seconds exceeds difference in event times ${timeDiff} seconds for event_id ${earlierEvent.id} and event_id ${laterEvent.id} ${new Date(earlierEvent.scheduledTimeEnd).toISOString()} to ${new Date(laterEvent.scheduledTimeStart).toISOString()}`
				);
				fail = true;
			}
		}
	}
	return fail;
}

async function validateCompanyDurations(tours: ToursWithRequests): Promise<boolean> {
	let fail = false;
	console.log('Validating leg durations from/to company...');
	for (const tour of tours) {
		if (tour.requests.length === 0) continue;

		const events = sortEventsByTime([...tour.requests.flatMap((r) => r.events)]);
		const fromCompanyFwd = await oneToMany(
			tour.companyLat!,
			tour.companyLng!,
			events[0].lat,
			events[0].lng
		);
		const fromCompanyBwd = await oneToMany(
			events[0].lat,
			events[0].lng,
			tour.companyLat!,
			tour.companyLng!,
			true
		);

		if (
			fromCompanyFwd !== null &&
			fromCompanyBwd !== null &&
			Math.abs(fromCompanyFwd - events[0].prevLegDuration / 1000) > 1 &&
			Math.abs(fromCompanyBwd - events[0].prevLegDuration / 1000) > 1
		) {
			console.log(
				`Duration from company to first event does not match in tour with id: ${tour.tourId} with first event: ${events[0].id}, duration in db: ${events[0].prevLegDuration / 1000} duration: ${fromCompanyFwd} or ${fromCompanyBwd}`
			);
			fail = true;
		}
		if (events[0].scheduledTimeEnd - events[0].prevLegDuration - tour.startTime !== 0) {
			console.log(`Unnecessary wait time after departure in tour with id: ${tour.tourId}`);
			fail = true;
		}
		if (
			tour.endTime -
				events[events.length - 1].scheduledTimeStart -
				events[events.length - 1].nextLegDuration !==
			0
		) {
			console.log(`Unnecessary wait time after arrival in tour with id: ${tour.tourId}`);
			fail = true;
		}

		const toCompany = await oneToMany(
			events[events.length - 1].lat,
			events[events.length - 1].lng,
			tour.companyLat!,
			tour.companyLng!
		);
		if (
			toCompany !== null &&
			Math.abs(toCompany + 60 - events[events.length - 1].nextLegDuration / 1000) > 1
		) {
			console.log(
				`Duration to company from last event does not match in tour with id: ${tour.tourId}, last event id: ${events[events.length - 1].id} duration in db: ${events[events.length - 1].nextLegDuration / 1000} duration: ${toCompany + 60}`
			);
			fail = true;
		}
	}
	return fail;
}

async function validateAddressCoordinatesMatch(tours: ToursWithRequests) {
	console.log('Validating that addresses match coordinates...');
	for (const event of tours.flatMap((t) => t.requests.flatMap((r) => r.events))) {
		const reverseGeoResult = await reverseGeo(event);
		if (event.address !== reverseGeoResult) {
			console.log('Address does not match for event with id: ', event.id, { reverseGeoResult });
		}
	}
	return false;
}

export async function healthCheck(vehicleId?: number, dayStart?: number) {
	const allTours = await getToursWithRequests(
		true,
		undefined,
		dayStart ? [dayStart, dayStart + DAY] : undefined,
		vehicleId
	);
	const uncancelledTours = await getToursWithRequests(
		false,
		undefined,
		dayStart ? [dayStart, dayStart + DAY] : undefined,
		vehicleId
	);
	let fail = false;
	if (allTours) {
		console.log('Validating tours...');
		fail = validateRequestHas2Events(uncancelledTours) ? true : fail;
		fail = validateToursWithNoEvents(uncancelledTours) ? true : fail;
		fail = validateTourAndRequestCancelled(allTours) ? true : fail;
		fail = validateEventParameters(uncancelledTours) ? true : fail;
		fail = validateEventTimeNoOverlap(uncancelledTours) ? true : fail;
		fail = validateEventsAreInsideTours(uncancelledTours) ? true : fail;
		fail = validateScheduledTimeStartBeforeEnd(uncancelledTours) ? true : fail;
		fail = validateScheduledIntervalSize(uncancelledTours) ? true : fail;
		fail = (await validateDirectDurations(uncancelledTours)) ? true : fail;
		fail = (await validateLegDurations(uncancelledTours)) ? true : fail;
		fail = (await validateCompanyDurations(uncancelledTours)) ? true : fail;
		fail = (await validateAddressCoordinatesMatch(allTours)) ? true : fail;
	} else {
		console.log('No tours found or there was an error fetching the data.');
	}
	return fail;
}
