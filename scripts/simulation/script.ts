#!/usr/bin/env ts-node

import 'dotenv/config';
import { bookingApi, BookingParameters } from '../../src/lib/server/booking/taxi/bookingApi';
import { cancelRequest } from '../../src/lib/server/db/cancelRequest';
import { moveTour } from '../../src/lib/server/moveTour';
import { addAvailability } from '../../src/lib/server/addAvailability';
import { getToursWithRequests } from '../../src/lib/server/db/getTours';
import { cancelTour } from '../../src/lib/server/cancelTour';
import { type Coordinates } from '../../src/lib/util/Coordinates';
import { generateBookingParameters } from './generateBookingParameters';
import { randomInt } from './randomInt';
import * as fs from 'fs';
import * as readline from 'readline';
import { DAY } from '../../src/lib/util/time';
import { healthCheck } from '../../src/lib/server/util/healthCheck';
import { healthCheck as healthCheckRideShare } from '../../src/lib/server/util/healthCheckRideShare';
import { logHelp } from './logHelp';
import { exec } from 'child_process';
import path from 'path';
import { white } from '../../src/lib/server/booking/testUtils';
import { getCost } from '../../src/lib/testHelpers';
import { MAX_MATCHING_DISTANCE } from '../../src/lib/constants';
import { PlanData } from '../../src/lib/openapi';
import { planAndSign } from '../../src/lib/planAndSign';
import { lngLatToStr } from '../../src/lib/util/lngLatToStr';
import {
	ExpectedConnection,
	expectedConnectionFromLeg
} from '../../src/lib/server/booking/expectedConnection';
import { rediscoverWhitelistRequestTimes } from '../../src/lib/server/util/rediscoverWhitelistRequestTimes';
import {
	acceptRideShareRequest,
	addRideShareTour,
	rideShareApi
} from '../../src/lib/server/booking/index';
import { getRideShareTours } from '../../src/lib/server/util/getRideShareTours';
import {
	getRideShareTourByRequest,
	type RideShareTourDb
} from '../../src/lib/server/booking/rideShare/getRideShareTours';
import { cancelRideShareRequest } from '../../src/lib/server/booking/rideShare/cancelRideShareRequest';
import { cancelRideShareTour } from '../../src/lib/server/booking/rideShare/cancelRideShareTour';

const BACKUP_DIR = './scripts/simulation/backups/';

const dbUrl = 'postgresql://postgres:pw@localhost:6500/prima';
const dbUser = process.env.POSTGRES_USER;
const dbPassword = process.env.POSTGRES_PASSWORD;
const targetDatabase = process.env.POSTGRES_DB || 'prima';

console.log(`Starting full backup for database "${targetDatabase}"...`);
let counter = 0;

enum Action {
	BOOKING,
	CANCEL_REQUEST,
	CANCEL_TOUR,
	MOVE_TOUR,
	ADD_RIDE_SHARE_TOUR,
	BOOK_RIDE_SHARE,
	ACCPEPT_RIDE_SHARE_TOUR,
	CANCEL_REQUEST_RS,
	CANCEL_TOUR_RS,
	PUBLIC_TRANSPORT
}

type ActionType = {
	action: Action;
	probability: number;
	text: string;
};

const actionProbabilities: ActionType[] = [
	{ action: Action.BOOKING, probability: 0.375, text: 'booking' },
	{ action: Action.CANCEL_REQUEST, probability: 0.025, text: 'cancel request' },
	{ action: Action.CANCEL_TOUR, probability: 0.025, text: 'cancel tour' },
	{ action: Action.MOVE_TOUR, probability: 0.05, text: 'move tour' },
	{ action: Action.ADD_RIDE_SHARE_TOUR, probability: 0.05, text: 'add ride share tour' },
	{ action: Action.BOOK_RIDE_SHARE, probability: 0.125, text: 'book ride share' },
	{ action: Action.ACCPEPT_RIDE_SHARE_TOUR, probability: 0.3, text: 'accept ride share' },
	{ action: Action.CANCEL_REQUEST_RS, probability: 0.025, text: 'cancel request rs' },
	{ action: Action.CANCEL_TOUR_RS, probability: 0.025, text: 'cancel tour rs' },
	{ action: Action.PUBLIC_TRANSPORT, probability: 0, text: 'public transport' }
];

async function readCoordinates(): Promise<Coordinates[]> {
	const coordinates: Coordinates[] = [];
	const filepath = './scripts/simulation/preparedCoords.csv';

	const fileStream = fs.createReadStream(filepath);
	const rl = readline.createInterface({
		input: fileStream,
		crlfDelay: Infinity
	});

	let isFirstLine = true;

	for await (const line of rl) {
		if (isFirstLine) {
			isFirstLine = false;
			continue;
		}

		const parts = line.split(',');
		if (parts.length >= 2) {
			try {
				const lng = parseFloat(parts[0]);
				const lat = parseFloat(parts[1]);

				if (isNaN(lng) || isNaN(lat)) {
					throw new Error('Invalid number');
				}

				coordinates.push({ lng, lat });
			} catch {
				console.warn(`Skipping row due to conversion error: ${line}`);
			}
		}
	}

	if (coordinates.length === 0) {
		throw new Error('No valid coordinates found in the CSV file');
	}

	return coordinates;
}

async function addInitialAvailabilities(company: number, vehicle: number) {
	await addAvailability(Date.now(), Date.now() + DAY * 14, company, vehicle);
}

const isActionChosen = (r: number, a: ActionType) => {
	if (r <= a.probability) {
		return true;
	}
	return false;
};

const getAction = (r: number) => {
	let current = r;
	for (const [i, a] of actionProbabilities.entries()) {
		if (isActionChosen(current, a)) {
			return i;
		}
		current -= a.probability;
	}
	return undefined;
};

async function addRideShareTourLocal(
	coordinates: Coordinates[],
	restricted: Coordinates[] | undefined
) {
	const parameters: BookingParameters = await generateBookingParameters(coordinates, restricted);
	const connection: ExpectedConnection = parameters.connection1!;
	const capacities = parameters.capacities;
	const request = await addRideShareTour(
		connection.startFixed ? connection.startTime : connection.targetTime,
		connection.startFixed,
		capacities.passengers,
		capacities.luggage,
		1,
		1,
		connection.start,
		connection.target,
		connection.start.address,
		connection.target.address
	);
	console.log(`Adding a ride share tour was ${request === undefined ? 'not' : ''} succesful.`);
	if (request === undefined) {
		return false;
	}
	const newTour: RideShareTourDb = await getRideShareTourByRequest(request);
	return {
		vehicleId: newTour[0].vehicle,
		dayStart: newTour[0].requests[0].events[0].communicatedTime
	};
}

async function acceptRideShareRequestLocal() {
	const tours = await getRideShareTours(false, true);
	const requests = tours.flatMap((t) => t.requests);
	if (requests.length === 0) {
		return false;
	}
	const r = randomInt(0, requests.length);
	const request = requests[r];
	const tour = tours.find((t) => t.requests.some((r) => r.requestId === r.requestId))!;
	const response = await acceptRideShareRequest(request.requestId, 1);
	if (response.status === 200) {
		console.log(`Successfully accepted ride share request with idx ${request.requestId}.`);
		return { vehicleId: tour.vehicleId, dayStart: Math.floor(tour.startTime / DAY) * DAY };
	}
	return response.status !== 404;
}

async function bookFull(
	coordinates: Coordinates[],
	restricted: Coordinates[] | undefined,
	mode?: string,
	compareCosts?: boolean
) {
	const parameters = await generateBookingParameters(coordinates, restricted);
	const potentialKids = parameters.capacities.passengers - 1;
	const kidsZeroToTwo = randomInt(0, potentialKids);
	const kidsThreeToFour = randomInt(0, potentialKids - kidsZeroToTwo);
	const kidsFiveToSix = randomInt(0, potentialKids - kidsThreeToFour);
	console.log(
		'SimLOGS',
		{ fromPlace: lngLatToStr(parameters.connection1.start) },
		{ toPlace: lngLatToStr(parameters.connection1.target) }
	);
	const modes = mode ? ['WALK', mode] : ['WALK'];
	const q = {
		query: {
			time: new Date(
				parameters.connection1.startFixed
					? parameters.connection1.startTime
					: parameters.connection1.targetTime
			).toISOString(),
			arriveBy: !parameters.connection1.startFixed,
			fromPlace: lngLatToStr(parameters.connection1.start),
			toPlace: lngLatToStr(parameters.connection1.target),
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
		chosenItinerary.legs[0].from.name = parameters.connection1.start.address;
	}
	if (chosenItinerary.legs[chosenItinerary.legs.length - 1].to.name === 'END') {
		chosenItinerary.legs[chosenItinerary.legs.length - 1].to.name =
			parameters.connection1.target.address;
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
		parameters.connection1.startFixed,
		isDirect,
		firstOdmIndex,
		lastOdmIndex,
		chosenItinerary.legs
	);
	console.log(
		{ isDirect },
		{ requestedTime1: new Date(requestedTime1).toISOString() },
		{ startFixed: parameters.connection1.startFixed },
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
				parameters.connection1.startFixed
					? parameters.connection1.startTime
					: parameters.connection1.endTime
			).toISOString()
		}
	);
	const connection1 = expectedConnectionFromLeg(
		firstOdm,
		chosenItinerary.signature1,
		isDirect ? parameters.connection1.startFixed : firstOdmIndex !== 0,
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

async function booking(
	coordinates: Coordinates[],
	restricted: Coordinates[] | undefined,
	doWhitelist?: boolean,
	compareCosts?: boolean
) {
	const parameters = await generateBookingParameters(coordinates, restricted);
	const potentialKids = parameters.capacities.passengers - 1;
	const kidsZeroToTwo = randomInt(0, potentialKids);
	const kidsThreeToFour = randomInt(0, potentialKids - kidsZeroToTwo);
	const kidsFiveToSix = randomInt(0, potentialKids - kidsThreeToFour);
	const requestedTime = parameters.connection1.startFixed
		? parameters.connection1.startTime
		: parameters.connection1.targetTime;
	const body = JSON.stringify({
		start: parameters.connection1.start,
		target: parameters.connection1.target,
		startBusStops: [],
		targetBusStops: [],
		directTimes: [requestedTime],
		startFixed: parameters.connection1.startFixed,
		capacities: parameters.capacities
	});
	const whiteResponse = await white(body).then((r) => r.json());
	if (doWhitelist) {
		if (whiteResponse.direct[0] === null) {
			console.log('whitelist was not succesful.');
			return false;
		}
		parameters.connection1.startTime = whiteResponse.direct[0]!.pickupTime;
		parameters.connection1.targetTime = whiteResponse.direct[0]!.dropoffTime;
		parameters.connection1.requestedTime = requestedTime;
	}
	return await bookingApiCall(
		parameters,
		kidsZeroToTwo,
		kidsThreeToFour,
		kidsFiveToSix,
		doWhitelist,
		compareCosts
	);
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

async function bookingApiCall(
	parameters: BookingParameters,
	kidsZeroToTwo: number,
	kidsThreeToFour: number,
	kidsFiveToSix: number,
	doWhitelist?: boolean,
	compareCosts?: boolean
) {
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

async function cancelRequestLocal() {
	const requests = (await getToursWithRequests(false)).flatMap((t) =>
		t.requests.map((r) => {
			return { ...t, ...r };
		})
	);
	if (requests.length === 0) {
		return false;
	}
	const r = randomInt(0, requests.length);
	await cancelRequest(requests[r].requestId, requests[r].companyId);
	return {
		vehicleId: requests[r].vehicleId,
		dayStart: Math.floor(requests[r].startTime / DAY) * DAY
	};
}

async function cancelTourLocal() {
	const tours = await getToursWithRequests(false);
	if (tours.length === 0) {
		return false;
	}
	const r = randomInt(0, tours.length);
	await cancelTour(tours[r].tourId, 'message', tours[r].companyId);
	return { vehicleId: tours[r].vehicleId, dayStart: Math.floor(tours[r].startTime / DAY) * DAY };
}

async function moveTourLocal() {
	const tours = await getToursWithRequests(false);
	if (tours.length === 0) {
		return false;
	}
	const r = randomInt(0, tours.length);
	const tour = tours[r];
	await moveTour(tour.tourId, tour.vehicleId, tour.companyId);
	return { vehicleId: tour.vehicleId, dayStart: Math.floor(tour.startTime / DAY) * DAY };
}

async function cancelRequestRsLocal() {
	const requests = (await getRideShareTours(false, undefined, false)).flatMap((t) =>
		t.requests.map((r) => {
			return { ...t, ...r };
		})
	);
	if (requests.length === 0) {
		return false;
	}
	const r = randomInt(0, requests.length);
	await cancelRideShareRequest(requests[r].requestId, 1);
	return {
		vehicleId: requests[r].vehicleId,
		dayStart: Math.floor(requests[r].startTime / DAY) * DAY
	};
}

async function cancelTourRsLocal() {
	const tours = await getRideShareTours(false, false);
	if (tours.length === 0) {
		return false;
	}
	const r = randomInt(0, tours.length);
	await cancelRideShareTour(tours[r].tourId, 1);
	return { vehicleId: tours[r].vehicleId, dayStart: Math.floor(tours[r].startTime / DAY) * DAY };
}

export async function simulation(params: {
	backups?: boolean;
	healthChecks?: boolean;
	restrict?: boolean;
	ongoing?: boolean;
	runs?: number;
	finishTime?: number;
	whitelist?: boolean;
	cost?: boolean;
	full?: boolean;
}): Promise<boolean> {
	async function mainLoop(i: number) {
		const r = Math.random();
		console.log('RANDOM API ITERATION: ', i, ' with random value: ', r);
		const actionIdx = getAction(r);
		if (actionIdx === undefined || actionIdx < 0 || actionIdx >= actionProbabilities.length) {
			console.log('chose: nothing', { actionIdx }, { r });
			errorCount++;
			return true;
		}
		const action = actionProbabilities[actionIdx];
		chosen[actionIdx] += 1;
		console.log('Chose:', action.text);
		let lastActionSpecifics: { vehicleId: number; dayStart: number } | boolean = false;
		try {
			switch (action.action) {
				case Action.BOOKING:
					if (params.full) {
						lastActionSpecifics = await bookFull(
							coordinates,
							restrictedCoordinates,
							'ODM',
							params.cost
						);
						if (lastActionSpecifics === true) {
							return true;
						}
					} else {
						lastActionSpecifics = await booking(
							coordinates,
							restrictedCoordinates,
							params.whitelist,
							params.cost
						);
						if (lastActionSpecifics === true) {
							return true;
						}
					}
					break;
				case Action.CANCEL_REQUEST:
					lastActionSpecifics = await cancelRequestLocal();
					break;
				case Action.CANCEL_TOUR:
					lastActionSpecifics = await cancelTourLocal();
					break;
				case Action.MOVE_TOUR:
					lastActionSpecifics = await moveTourLocal();
					break;
				case Action.ACCPEPT_RIDE_SHARE_TOUR:
					lastActionSpecifics = await acceptRideShareRequestLocal();
					break;
				case Action.ADD_RIDE_SHARE_TOUR:
					lastActionSpecifics = await addRideShareTourLocal(coordinates, restrictedCoordinates);
					break;
				case Action.BOOK_RIDE_SHARE:
					if (params.full) {
						lastActionSpecifics = await bookFull(
							coordinates,
							restrictedCoordinates,
							'RIDE_SHARING',
							params.cost
						);
						if (lastActionSpecifics === true) {
							return true;
						}
					}
					break;
				case Action.CANCEL_REQUEST_RS:
					lastActionSpecifics = await cancelRequestRsLocal();
					break;
				case Action.CANCEL_TOUR_RS:
					lastActionSpecifics = await cancelTourRsLocal();
					break;
				case Action.PUBLIC_TRANSPORT:
					lastActionSpecifics = await bookFull(coordinates, restrictedCoordinates);
					break;
			}
		} catch (e) {
			errors.push(JSON.stringify(e, null, 2));
		}
		if (params.backups) {
			await doBackup(++counter);
		}
		console.log('');
		if (typeof lastActionSpecifics !== 'boolean') {
			if (
				params.healthChecks && lastActionWasRideShare(actionIdx)
					? await healthCheckRideShare()
					: await healthCheck(lastActionSpecifics.vehicleId, lastActionSpecifics.dayStart)
			) {
				return true;
			}
		}
	}

	const probabilitySum = actionProbabilities.reduce((sum, curr) => sum + curr.probability, 0);
	if (Math.abs(probabilitySum - 1) > 0.00000001) {
		console.log('The probabilities in actionProbabilies must add to 1 exactly. ', {
			probabilitySum
		});
		process.exit(1);
	}
	const coordinates = await readCoordinates();
	// The following coordinates are used to restrict either start or target (which is chosen at random) in each booking.
	// The restriction is a 'square' roughly matching the town of schleife.
	// This can be activated by using the --restrict flag.
	const maxLat = 51.54675239279669;
	const minLat = 51.52743007431573;
	const maxLng = 14.540862766349306;
	const minLng = 14.511228293715078;
	const restrictedCoordinates = params.restrict
		? coordinates.filter(
				(c) => c.lat <= maxLat && c.lat >= minLat && c.lng <= maxLng && c.lng >= minLng
			)
		: undefined;
	await addInitialAvailabilities(1, 1);
	await addInitialAvailabilities(1, 2);
	const chosen = Array.from({ length: actionProbabilities.length }, (_) => 0);
	let errorCount = 0;
	const errors: string[] = [];
	if (params.ongoing) {
		let idx = 0;
		while (true) {
			if (await mainLoop(idx++)) {
				return true;
			}
		}
	} else if (params.finishTime) {
		let idx = 0;
		while (Date.now() < params.finishTime) {
			if (await mainLoop(idx++)) {
				return true;
			}
		}
	} else if (params.runs) {
		for (let i = 0; i != params.runs; ++i) {
			if (await mainLoop(i)) {
				return true;
			}
		}
	} else {
		if (await mainLoop(0)) {
			return true;
		}
	}
	for (const [i, a] of actionProbabilities.entries()) {
		console.log('action ', a.text, ' was chosen ', chosen[i], ' times.');
	}
	console.log('There were ', errorCount, ' errors.');
	console.log('Errors: ', JSON.stringify(errors, null, 2));
	const tours = await getToursWithRequests(false);
	console.log(
		`There are currently ${tours.reduce((acc, curr) => (acc = acc + curr.requests.length), 0)} uncancelled requests across ${tours.length} tours.`
	);
	console.log('RANDOM API END');
	return false;
}

function lastActionWasRideShare(idx: number) {
	return (
		actionProbabilities[idx].action === Action.ADD_RIDE_SHARE_TOUR ||
		actionProbabilities[idx].action === Action.BOOK_RIDE_SHARE ||
		actionProbabilities[idx].action === Action.ACCPEPT_RIDE_SHARE_TOUR
	);
}

async function main() {
	let healthChecks = false;
	let runs: number | undefined = undefined;
	let finishTime: number | undefined = undefined;
	let ongoing = false;
	let help = false;
	let restrict = false;
	let backups = false;
	let whitelist = false;
	let cost = false;
	let full = false;
	for (const arg of process.argv) {
		if (arg === '--health') {
			healthChecks = true;
		}
		if (arg === '--wl') {
			whitelist = true;
		}
		if (arg === '--full') {
			full = true;
		}
		if (arg === '--cost') {
			cost = true;
		}
		if (arg === '--bu') {
			backups = true;
		}
		if (arg === '--restrict') {
			restrict = true;
		}
		if (arg.startsWith('--mode')) {
			const value = arg.split('=')[1];
			const modes = ['rs', 'taxi', 'pt', 'taxionly'];
			if (!modes.some((m) => m === value)) {
				console.error('Invalid value for --mode. Must be any of: rs taxi pt taxionly.');
				process.exit(1);
			}
			setActionProbabilities(value);
		}
		if (arg.startsWith('--runs=')) {
			const value = parseInt(arg.split('=')[1], 10);
			if (isNaN(value) || value <= 0) {
				console.error('Invalid value for --runs. Must be a positive integer.');
				process.exit(1);
			}
			runs = value;
		} else if (arg.startsWith('--seconds=')) {
			const value = parseInt(arg.split('=')[1], 10);
			if (isNaN(value) || value <= 0) {
				console.error('Invalid value for --runs. Must be a positive integer.');
				process.exit(1);
			}
			finishTime = Date.now() + 1000 * value;
		} else if (arg === '--ongoing') {
			ongoing = true;
		} else if (arg === '--help') {
			help = true;
		}
	}

	if (help) {
		logHelp();
		process.exit(0);
	}
	simulation({ backups, healthChecks, restrict, ongoing, runs, finishTime, whitelist, cost, full });
}
main().catch((err) => {
	console.error(err);
	process.exit(1);
});

function findLastIndex<T>(
	arr: T[],
	predicate: (value: T, index: number, array: T[]) => boolean
): number {
	for (let i = arr.length - 1; i >= 0; i--) {
		if (predicate(arr[i], i, arr)) return i;
	}
	return -1;
}

async function doBackup(counter: number) {
	const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '_');
	const FILE_NAME = `full_backup_${timestamp}${counter}.sql`;
	const BACKUP_FILE_PATH = path.join(BACKUP_DIR, FILE_NAME);
	const command = `PGPASSWORD=${dbPassword} pg_dump --dbname=${dbUrl} --username=${dbUser} --no-password --format=plain --file="${BACKUP_FILE_PATH}"`;
	await new Promise<void>((resolve, reject) => {
		exec(command, (error, stdout, stderr) => {
			if (error) {
				console.error(`Error during backup: ${error.message}`);
				return reject(error);
			}
			if (stdout) {
				console.log(`Backup stdout: ${stdout}`);
			}
			if (stderr) console.warn(`Backup stderr: ${stderr}`);
			console.log(`Full backup successful! Backup saved to ${BACKUP_FILE_PATH}`);
			resolve();
		});
	});
}

function setActionProbabilities(mode: string) {
	function setActionProbability(probability: number, action: Action) {
		actionProbabilities[actionProbabilities.findIndex((a) => a.action === action)].probability =
			probability;
	}

	const actions = [
		Action.ACCPEPT_RIDE_SHARE_TOUR,
		Action.ADD_RIDE_SHARE_TOUR,
		Action.BOOKING,
		Action.BOOK_RIDE_SHARE,
		Action.CANCEL_REQUEST,
		Action.CANCEL_TOUR,
		Action.MOVE_TOUR,
		Action.PUBLIC_TRANSPORT,
		Action.CANCEL_REQUEST_RS,
		Action.CANCEL_TOUR_RS,
		Action.PUBLIC_TRANSPORT
	];
	for (const action of actions) {
		setActionProbability(0, action);
	}
	switch (mode) {
		case 'rs':
			setActionProbability(0.2, Action.ACCPEPT_RIDE_SHARE_TOUR);
			setActionProbability(0.2, Action.ADD_RIDE_SHARE_TOUR);
			setActionProbability(0.5, Action.BOOK_RIDE_SHARE);
			setActionProbability(0.05, Action.CANCEL_REQUEST_RS);
			setActionProbability(0.05, Action.CANCEL_TOUR_RS);
			break;
		case 'taxi':
			setActionProbability(0.9, Action.BOOKING);
			setActionProbability(0.025, Action.CANCEL_REQUEST);
			setActionProbability(0.025, Action.CANCEL_TOUR);
			setActionProbability(0.05, Action.MOVE_TOUR);
			break;
		case 'pt':
			setActionProbability(1, Action.PUBLIC_TRANSPORT);
			break;
		case 'taxionly':
			setActionProbability(1, Action.BOOKING);
			break;
	}
	console.log('Updated action probabilities:', JSON.stringify(actionProbabilities));
}
