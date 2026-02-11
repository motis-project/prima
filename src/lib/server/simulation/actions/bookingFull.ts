import { MAX_MATCHING_DISTANCE } from '$lib/constants';
import { type PlanData } from '$lib/openapi';
import { planAndSign } from '$lib/planAndSign';
import { rideShareApi } from '$lib/server/booking';
import { expectedConnectionFromLeg } from '$lib/server/booking/expectedConnection';
import { bookingApi, type BookingParameters } from '$lib/server/booking/taxi/bookingApi';
import { getToursWithRequests } from '$lib/server/db/getTours';
import { getRideShareTours } from '$lib/server/util/getRideShareTours';
import { rediscoverWhitelistRequestTimes } from '$lib/server/util/rediscoverWhitelistRequestTimes';
import { getCost } from '$lib/testHelpers';
import { type Coordinates } from '$lib/util/Coordinates';
import { lngLatToStr } from '$lib/util/lngLatToStr';
import { DAY } from '$lib/util/time';
import { generateBookingParameters } from '../generateBookingParameters';
import { randomInt } from '../randomInt';

function findLastIndex<T>(
	arr: T[],
	predicate: (value: T, index: number, array: T[]) => boolean
): number {
	for (let i = arr.length - 1; i >= 0; i--) {
		if (predicate(arr[i], i, arr)) return i;
	}
	return -1;
}

async function rideShareApiCall(
	parameters: BookingParameters,
	kidsZeroToTwo: number,
	kidsThreeToFour: number,
	kidsFiveToSix: number,
	doWhitelist?: boolean,
	compareCosts?: boolean
) {
	const toursBefore = await getRideShareTours(false);
	const response = await rideShareApi(
		parameters,
		1,
		true,
		kidsZeroToTwo,
		kidsThreeToFour,
		kidsFiveToSix
	);
	const requestId = response.request1Id ?? response.request2Id;
	const toursAfter = await getToursWithRequests(false);
	const t = toursAfter.filter((t) => t.requests.some((r) => r.requestId === requestId));
	if (t.length !== 1) {
		console.log(`Found ${t.length} tours containing the new request.`);
		if (doWhitelist) {
			return true;
		}
	}
	const newTour = t[0];
	if (compareCosts) {
		let fail = false;
		const oldTours = toursBefore.filter((t) =>
			t.requests.some((r1) => newTour.requests.some((r2) => r2.requestId === r1.requestId))
		);
		const newCost = getCost(newTour);
		const oldCost = oldTours.reduce(
			(acc, curr) => {
				const cost = getCost(curr);
				acc.approachPlusReturnDuration += cost.approachPlusReturnDuration;
				acc.fullyPayedDuration += cost.fullyPayedDuration;
				acc.waitingTime += cost.waitingTime;
				acc.weightedPassengerDuration += cost.weightedPassengerDuration;
				return acc;
			},
			{
				approachPlusReturnDuration: 0,
				fullyPayedDuration: 0,
				waitingTime: 0,
				weightedPassengerDuration: 0
			}
		);
		if (
			Math.abs(
				newCost.approachPlusReturnDuration -
					(oldCost.approachPlusReturnDuration + (response.approachPlusReturnDurationDelta ?? 0))
			) > 2
		) {
			console.log(
				`approachPlusReturnDuration times do not match old: ${oldCost.approachPlusReturnDuration}, relative: ${response.approachPlusReturnDurationDelta}, combined: ${oldCost.approachPlusReturnDuration + (response.approachPlusReturnDurationDelta ?? 0)} and new: ${newCost.approachPlusReturnDuration}`
			);
			console.log(
				`For new tour: ${newTour.tourId} and old tours: ${oldTours.map((t) => t.tourId)}`
			);
			fail = true;
		}
		if (
			Math.abs(
				newCost.fullyPayedDuration -
					(oldCost.fullyPayedDuration + (response.fullyPayedDurationDelta ?? 0))
			) > 2
		) {
			console.log(
				`fullyPayedDuration times do not match old: ${oldCost.fullyPayedDuration}, relative: ${response.fullyPayedDurationDelta}, combined: ${oldCost.fullyPayedDuration + (response.fullyPayedDurationDelta ?? 0)} and new: ${newCost.fullyPayedDuration}`
			);
			console.log(
				`For new tour: ${newTour.tourId} and old tours: ${oldTours.map((t) => t.tourId)}`
			);
			fail = true;
		}
		if (Math.abs(newCost.waitingTime - (oldCost.waitingTime + (response.waitingTime ?? 0))) > 2) {
			console.log(
				`Waiting times do not match old: ${oldCost.waitingTime}, relative: ${response.waitingTime}, combined: ${oldCost.waitingTime + (response.waitingTime ?? 0)} and new: ${newCost.waitingTime}`
			);
			console.log(
				`For new tour: ${newTour.tourId} and old tours: ${oldTours.map((t) => t.tourId)}`
			);
			fail = true;
		}
		if (
			Math.abs(
				newCost.weightedPassengerDuration -
					(oldCost.weightedPassengerDuration + (response.passengerDuration ?? 0))
			) > 2
		) {
			console.log(
				`Passenger times do not match old: ${oldCost.weightedPassengerDuration}, relative: ${response.passengerDuration}, combined: ${oldCost.weightedPassengerDuration + (response.passengerDuration ?? 0)} and new: ${newCost.weightedPassengerDuration}`
			);
			console.log(
				`For new tour: ${newTour.tourId} and old tours: ${oldTours.map((t) => t.tourId)}`
			);
			fail = true;
		}
		if (fail) {
			return true;
		}
		console.log('costs do match');
	}
	console.log(response.status === 200 ? 'succesful booking' : 'failed to book');
	if (doWhitelist && response.status !== 200) {
		return true;
	}
	return { vehicleId: newTour.vehicleId, dayStart: Math.floor(newTour.startTime / DAY) * DAY };
}

export async function bookingApiCall(
	parameters: BookingParameters,
	kidsZeroToTwo: number,
	kidsThreeToFour: number,
	kidsFiveToSix: number,
	doWhitelist?: boolean,
	compareCosts?: boolean
) {
	console.log('doing2');
	const toursBefore = await getToursWithRequests(false);
	const response = await bookingApi(
		parameters,
		1,
		false,
		true,
		kidsZeroToTwo,
		kidsThreeToFour,
		kidsFiveToSix,
		0,
		!(doWhitelist ?? false)
	);
	const requestId = response.request1Id ?? response.request2Id;
	const toursAfter = await getToursWithRequests(false);
	const t = toursAfter.filter((t) => t.requests.some((r) => r.requestId === requestId));
	if (t.length !== 1) {
		console.log(`Found ${t.length} tours containing the new request.`);
		if (doWhitelist) {
			return true;
		}
	}
	const newTour = t[0];
	if (compareCosts) {
		let fail = false;
		const oldTours = toursBefore.filter((t) =>
			t.requests.some((r1) => newTour.requests.some((r2) => r2.requestId === r1.requestId))
		);
		const newCost = getCost(newTour);
		const oldCost = oldTours.reduce(
			(acc, curr) => {
				const cost = getCost(curr);
				acc.approachPlusReturnDuration += cost.approachPlusReturnDuration;
				acc.fullyPayedDuration += cost.fullyPayedDuration;
				acc.waitingTime += cost.waitingTime;
				acc.weightedPassengerDuration += cost.weightedPassengerDuration;
				return acc;
			},
			{
				approachPlusReturnDuration: 0,
				fullyPayedDuration: 0,
				waitingTime: 0,
				weightedPassengerDuration: 0
			}
		);
		if (
			Math.abs(
				newCost.approachPlusReturnDuration -
					(oldCost.approachPlusReturnDuration + (response.approachPlusReturnDurationDelta ?? 0))
			) > 2
		) {
			console.log(
				`approachPlusReturnDuration times do not match old: ${oldCost.approachPlusReturnDuration}, relative: ${response.approachPlusReturnDurationDelta}, combined: ${oldCost.approachPlusReturnDuration + (response.approachPlusReturnDurationDelta ?? 0)} and new: ${newCost.approachPlusReturnDuration}`
			);
			console.log(
				`For new tour: ${newTour.tourId} and old tours: ${oldTours.map((t) => t.tourId)}`
			);
			fail = true;
		}
		if (
			Math.abs(
				newCost.fullyPayedDuration -
					(oldCost.fullyPayedDuration + (response.fullyPayedDurationDelta ?? 0))
			) > 2
		) {
			console.log(
				`fullyPayedDuration times do not match old: ${oldCost.fullyPayedDuration}, relative: ${response.fullyPayedDurationDelta}, combined: ${oldCost.fullyPayedDuration + (response.fullyPayedDurationDelta ?? 0)} and new: ${newCost.fullyPayedDuration}`
			);
			console.log(
				`For new tour: ${newTour.tourId} and old tours: ${oldTours.map((t) => t.tourId)}`
			);
			fail = true;
		}
		if (Math.abs(newCost.waitingTime - (oldCost.waitingTime + (response.waitingTime ?? 0))) > 2) {
			console.log(
				`Waiting times do not match old: ${oldCost.waitingTime}, relative: ${response.waitingTime}, combined: ${oldCost.waitingTime + (response.waitingTime ?? 0)} and new: ${newCost.waitingTime}`
			);
			console.log(
				`For new tour: ${newTour.tourId} and old tours: ${oldTours.map((t) => t.tourId)}`
			);
			fail = true;
		}
		if (
			Math.abs(
				newCost.weightedPassengerDuration -
					(oldCost.weightedPassengerDuration + (response.passengerDuration ?? 0))
			) > 2
		) {
			console.log(
				`Passenger times do not match old: ${oldCost.weightedPassengerDuration}, relative: ${response.passengerDuration}, combined: ${oldCost.weightedPassengerDuration + (response.passengerDuration ?? 0)} and new: ${newCost.weightedPassengerDuration}`
			);
			console.log(
				`For new tour: ${newTour.tourId} and old tours: ${oldTours.map((t) => t.tourId)}`
			);
			fail = true;
		}
		if (fail) {
			return true;
		}
		console.log('costs do match');
	}
	console.log(response.status === 200 ? 'succesful booking' : 'failed to book');
	if (doWhitelist && response.status !== 200) {
		return true;
	}
	return { vehicleId: newTour.vehicleId, dayStart: Math.floor(newTour.startTime / DAY) * DAY };
}

export async function bookFull(
	coordinates: Coordinates[],
	restricted: Coordinates[] | undefined,
	mode?: string,
	compareCosts?: boolean
) {
	console.log('doing1');
	const parameters = await generateBookingParameters(coordinates, restricted);
	const potentialKids = parameters.capacities.passengers - 1;
	const kidsZeroToTwo = randomInt(0, potentialKids);
	const kidsThreeToFour = randomInt(0, potentialKids - kidsZeroToTwo);
	const kidsFiveToSix = randomInt(0, potentialKids - kidsThreeToFour);
	console.log(
		'SimLOGS',
		{ fromPlace: lngLatToStr(parameters.connection1!.start) },
		{ toPlace: lngLatToStr(parameters.connection1!.target) }
	);
	const modes = mode ? ['WALK', mode] : ['WALK'];
	const q = {
		query: {
			time: new Date(
				parameters.connection1!.startFixed
					? parameters.connection1!.startTime
					: parameters.connection1!.targetTime
			).toISOString(),
			arriveBy: !parameters.connection1!.startFixed,
			fromPlace: lngLatToStr(parameters.connection1!.start),
			toPlace: lngLatToStr(parameters.connection1!.target),
			preTransitModes: modes,
			postTransitModes: modes,
			directModes: modes,
			luggage: parameters.capacities.luggage,
			fastestDirectFactor: 1.6,
			maxMatchingDistance: MAX_MATCHING_DISTANCE,
			maxTravelTime: 1440,
			passengers: parameters.capacities.passengers
		}
	} as PlanData;
	const planResponse = await planAndSign(q.query, 'http://localhost:5173');
	if (planResponse === undefined) {
		console.log('PlanResponse was undefined.');
		return true;
	}
	const relevantItineraries = mode
		? planResponse.itineraries.filter((i) => i.legs.some((l) => l.mode === mode))
		: planResponse.itineraries;
	if (relevantItineraries.length === 0) {
		console.log('Found no itinerary with the selected mode.');
		return false;
	}
	for (const itinerary of relevantItineraries) {
		let monotonicTime = 0;
		for (const leg of itinerary.legs) {
			if (leg.mode == 'WALK') {
				continue;
			}
			if (new Date(leg.startTime).getTime() < monotonicTime + 1000 * 60 * 1) {
				const e = new Error(
					'Non-monotonic times in itinerary. Wrong communicated times? ' + JSON.stringify(itinerary)
				);
				console.log(e);
				return true;
			}
			monotonicTime = new Date(leg.endTime).getTime();
		}
	}
	const choice = randomInt(0, relevantItineraries.length);
	const chosenItinerary = relevantItineraries[choice];
	if (chosenItinerary.legs[0].from.name === 'START') {
		chosenItinerary.legs[0].from.name = parameters.connection1!.start.address ?? '';
	}
	if (chosenItinerary.legs[chosenItinerary.legs.length - 1].to.name === 'END') {
		chosenItinerary.legs[chosenItinerary.legs.length - 1].to.name =
			parameters.connection1!.target.address ?? '';
	}
	console.log(
		'chose itinerary #',
		choice,
		JSON.stringify(
			{
				...chosenItinerary,
				legs: chosenItinerary.legs.map((l) => {
					const { legGeometry: _, steps: _2, ...rest } = l;
					return rest;
				})
			},
			null,
			2
		)
	);
	if (mode === undefined) {
		return false;
	}
	const firstOdmIndex = chosenItinerary.legs.findIndex((l) => l.mode === mode);
	const lastOdmIndex = findLastIndex(chosenItinerary.legs, (l) => l.mode === mode);
	if (firstOdmIndex === -1) {
		console.log('OdmLeg was undefined.');
		return true;
	}
	const firstOdm = chosenItinerary.legs[firstOdmIndex];
	const lastOdm = chosenItinerary.legs[lastOdmIndex];
	const isDirect = chosenItinerary.legs.length === 1;

	const { requestedTime1, requestedTime2 } = rediscoverWhitelistRequestTimes(
		parameters.connection1!.startFixed,
		isDirect,
		firstOdmIndex,
		lastOdmIndex,
		chosenItinerary.legs
	);
	console.log(
		{ isDirect },
		{ requestedTime1: new Date(requestedTime1).toISOString() },
		{ startFixed: parameters.connection1!.startFixed },
		{
			legs: chosenItinerary.legs.map((l) => {
				return {
					start: new Date(l.scheduledStartTime).toISOString(),
					end: new Date(l.scheduledEndTime).toISOString(),
					mode: l.mode,
					from: JSON.stringify(l.from, null, 2),
					to: JSON.stringify(l.to, null, 2)
				};
			})
		},
		{
			time: new Date(
				parameters.connection1!.startFixed
					? parameters.connection1!.startTime
					: parameters.connection1!.targetTime
			).toISOString()
		}
	);
	const connection1 = expectedConnectionFromLeg(
		firstOdm,
		chosenItinerary.signature1,
		isDirect ? parameters.connection1!.startFixed : firstOdmIndex !== 0,
		requestedTime1
	);
	console.log(
		'SimLOGS',
		{ firstOdmStart: connection1?.start },
		{ firstOdmTarget: connection1?.target }
	);
	const connection2 =
		firstOdmIndex === lastOdmIndex
			? null
			: expectedConnectionFromLeg(lastOdm, chosenItinerary.signature2, true, requestedTime2);
	if (mode === 'ODM') {
		return await bookingApiCall(
			{ capacities: parameters.capacities, connection1, connection2 },
			kidsZeroToTwo,
			kidsThreeToFour,
			kidsFiveToSix,
			true,
			compareCosts
		);
	} else if (mode === 'RIDE_SHARING') {
		return await rideShareApiCall(
			{ capacities: parameters.capacities, connection1, connection2 },
			kidsZeroToTwo,
			kidsThreeToFour,
			kidsFiveToSix
		);
	} else {
		console.log('internal simulation script error, unexpected mode.', mode);
		return true;
	}
}
