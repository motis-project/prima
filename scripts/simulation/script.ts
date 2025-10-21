#!/usr/bin/env ts-node

import 'dotenv/config';
import { bookingApi, BookingParameters } from '../../src/lib/server/booking/taxi/bookingApi';
import { cancelRequest } from '../../src/lib/server/db/cancelRequest';
import { moveTour } from '../../src/lib/server/moveTour';
import { addAvailability } from '../../src/lib/server/addAvailability';
import { getToursWithRequests } from '../../src/lib/server/db/getTours';
import { cancelTour } from '../../src/lib/server/cancelTour';
import { type Coordinates } from '../../src/lib/util/Coordinates';
import { Interval } from '../../src/lib/util/interval';
import { generateBookingParameters } from './generateBookingParameters';
import { randomInt } from './randomInt';
import * as fs from 'fs';
import * as readline from 'readline';
import { DAY } from '../../src/lib/util/time';
import { healthCheck } from '../../src/lib/server/util/healthCheck';
import { logHelp } from './logHelp';
import { exec } from 'child_process';
import path from 'path';
import { white } from '../../src/lib/server/booking/testUtils';
import { getCost } from '../../src/lib/testHelpers';
import { MAX_MATCHING_DISTANCE } from '../../src/lib/constants';
import { PlanData } from '../../src/lib/openapi';
import { planAndSign } from '../../src/lib/planAndSign';
import { lngLatToStr } from '../../src/lib/util/lngLatToStr';
import { expectedConnectionFromLeg } from '../../src/lib/server/booking/expectedConnection';
import { rediscoverWhitelistRequestTimes } from '../../src/lib/server/util/rediscoverWhitelistRequestTimes';

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
	MOVE_TOUR
}

type ActionType = {
	action: Action;
	probability: number;
	text: string;
};

const actionProbabilities: ActionType[] = [
	{ action: Action.BOOKING, probability: 0.9, text: 'booking' },
	{ action: Action.CANCEL_REQUEST, probability: 0.025, text: 'cancel request' },
	{ action: Action.CANCEL_TOUR, probability: 0.025, text: 'cancel tour' },
	{ action: Action.MOVE_TOUR, probability: 0.05, text: 'move tour' }
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
	const interval = new Interval(Date.now(), Date.now() + DAY * 14);
	await addAvailability(interval, company, vehicle);
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

async function bookingFull(
	coordinates: Coordinates[],
	restricted: Coordinates[] | undefined,
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
			preTransitModes: ['WALK', 'ODM'],
			postTransitModes: ['WALK', 'ODM'],
			directModes: ['WALK', 'ODM'],
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
	const odmItineraries = planResponse.itineraries.filter((i) =>
		i.legs.some((l) => l.mode === 'ODM')
	);
	if (odmItineraries.length === 0) {
		console.log('There were no ODM-itineraries.');
		return false;
	}
	for (const itinerary of odmItineraries) {
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
				throw e;
			}
			monotonicTime = new Date(leg.endTime).getTime();
		}
	}
	const choice = randomInt(0, odmItineraries.length);
	const chosenItinerary = odmItineraries[choice];
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
	const firstOdmIndex = chosenItinerary.legs.findIndex((l) => l.mode === 'ODM');
	const lastOdmIndex = findLastIndex(chosenItinerary.legs, (l) => l.mode === 'ODM');
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
					mode: l.mode,from:l.from,to:l.to
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
	return await bookingApiCall(
		{ capacities: parameters.capacities, connection1, connection2 },
		kidsZeroToTwo,
		kidsThreeToFour,
		kidsFiveToSix,
		true,
		compareCosts
	);
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
		!(doWhitelist ?? false)
	);
	if (compareCosts) {
		let fail = false;
		const toursAfter = await getToursWithRequests(false);
		const requestId = response.request1Id ?? response.request2Id;
		const t = toursAfter.filter((t) => t.requests.some((r) => r.requestId === requestId));
		if (t.length !== 1) {
			console.log(`Found ${t.length} tours containing the new request.`);
			if (doWhitelist) {
				return true;
			}
		}
		const newTour = t[0];
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
	return false;
}

async function cancelRequestLocal() {
	const requests = (await getToursWithRequests(false)).flatMap((t) =>
		t.requests.map((r) => {
			return { ...t, ...r };
		})
	);
	if (requests.length === 0) {
		return;
	}
	const r = randomInt(0, requests.length);
	await cancelRequest(requests[r].requestId, requests[r].companyId);
}

async function cancelTourLocal() {
	const tours = await getToursWithRequests(false);
	if (tours.length === 0) {
		return;
	}
	const r = randomInt(0, tours.length);
	await cancelTour(tours[r].tourId, 'message', tours[r].companyId);
}

async function moveTourLocal() {
	const tours = await getToursWithRequests(false);
	if (tours.length === 0) {
		return;
	}
	const r = randomInt(0, tours.length);
	const tour = tours[r];
	await moveTour(tour.tourId, tour.vehicleId, tour.companyId);
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
		try {
			switch (action.action) {
				case Action.BOOKING:
					if (params.full) {
						if (await bookingFull(coordinates, restrictedCoordinates, params.cost)) {
							return true;
						}
					} else {
						if (await booking(coordinates, restrictedCoordinates, params.whitelist, params.cost)) {
							return true;
						}
					}
					break;
				case Action.CANCEL_REQUEST:
					await cancelRequestLocal();
					break;
				case Action.CANCEL_TOUR:
					await cancelTourLocal();
					break;
				case Action.MOVE_TOUR:
					await moveTourLocal();
					break;
			}
		} catch (e) {
			errors.push(JSON.stringify(e, null, 2));
		}
		if (params.backups) {
			counter++;
			const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '_');
			const FILE_NAME = `full_backup_${timestamp}${counter}.sql`;
			const BACKUP_FILE_PATH = path.join(BACKUP_DIR, FILE_NAME);
			const command = `PGPASSWORD=${dbPassword} pg_dump --dbname=${dbUrl} --username=${dbUser} --no-password --format=plain --file="${BACKUP_FILE_PATH}"`;
			exec(command, (error, _, stderr) => {
				if (error) {
					console.error(`Error during backup: ${error.message}`);
					return;
				}
				if (stderr) {
					console.warn(`Backup stderr: ${stderr}`);
				}
				console.log(`Full backup successful! Backup saved to ${BACKUP_FILE_PATH}`);
			});
		}
		console.log('');
		if (params.healthChecks && (await healthCheck())) {
			return true;
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
