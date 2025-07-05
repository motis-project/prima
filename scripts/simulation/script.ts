#!/usr/bin/env ts-node

import 'dotenv/config';
import { bookingApi } from '../../src/lib/server/booking/bookingApi';
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
import { white } from '../../src/lib/server/booking/tests/util';
import type { ToursWithRequests } from '../../src/lib/util/getToursTypes';
import { getCost } from '../../src/lib/testHelpers';

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
	{ action: Action.BOOKING, probability: 0.7, text: 'booking' },
	{ action: Action.CANCEL_REQUEST, probability: 0.1, text: 'cancel request' },
	{ action: Action.CANCEL_TOUR, probability: 0.1, text: 'cancel tour' },
	{ action: Action.MOVE_TOUR, probability: 0.1, text: 'move tour' }
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
	const body = JSON.stringify({
		start: parameters.connection1.start,
		target: parameters.connection1.target,
		startBusStops: [],
		targetBusStops: [],
		directTimes: [
			parameters.connection1.startFixed
				? parameters.connection1.startTime
				: parameters.connection1.targetTime
		],
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
	}
	let toursBefore: ToursWithRequests = [];
	if (compareCosts) {
		toursBefore = await getToursWithRequests(false);
	}
	const response = await bookingApi(
		parameters,
		1,
		true,
		kidsThreeToFour,
		kidsThreeToFour,
		kidsFiveToSix,
		!(doWhitelist ?? false)
	);
	if (compareCosts) {
		const toursAfter = await getToursWithRequests(false);
		const requestId = response.request1Id ?? response.request2Id;
		const t = toursAfter.filter((t) => t.requests.some((r) => r.requestId === requestId));
		if (t.length !== 1) {
			console.log(`Found ${t.length} tours containing the new request.`);
			return true;
		}
		const newTour = t[0];
		const oldTours: ToursWithRequests = toursBefore.filter((t) =>
			t.requests.some((r1) => newTour.requests.some((r2) => r2.requestId === r1.requestId))
		);
		const newCost = getCost(newTour);
		const oldCost = oldTours.reduce(
			(acc, curr) => {
				const cost = getCost(curr);
				acc.drivingTime += cost.drivingTime;
				acc.waitingTime += cost.waitingTime;
				acc.weightedPassengerDuration += cost.weightedPassengerDuration;
				return acc;
			},
			{ drivingTime: 0, waitingTime: 0, weightedPassengerDuration: 0 }
		);
		if (newCost.drivingTime !== oldCost.drivingTime + (response.taxiTime ?? 0)) {
			console.log(
				`Driving times do not match old: ${oldCost.drivingTime}, relative: ${response.taxiTime}, combined: ${oldCost.drivingTime + (response.taxiTime ?? 0)} and new: ${newCost.drivingTime}`
			);
			return true;
		}
		if (newCost.waitingTime !== oldCost.waitingTime + (response.waitingTime ?? 0)) {
			console.log(
				`Waiting times do not match old: ${oldCost.waitingTime}, relative: ${response.waitingTime}, combined: ${oldCost.waitingTime + (response.waitingTime ?? 0)} and new: ${newCost.waitingTime}`
			);
			return true;
		}
		if (
			newCost.weightedPassengerDuration -
				(oldCost.weightedPassengerDuration + (response.passengerDuration ?? 0)) >
			2
		) {
			console.log(
				`Passenger times do not match old: ${oldCost.weightedPassengerDuration}, relative: ${response.passengerDuration}, combined: ${oldCost.weightedPassengerDuration + (response.passengerDuration ?? 0)} and new: ${newCost.weightedPassengerDuration}`
			);
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
					if (await booking(coordinates, restrictedCoordinates, params.whitelist, params.cost)) {
						return true;
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

	for (const arg of process.argv) {
		if (arg === '--health') {
			healthChecks = true;
		}
		if (arg === '--wl') {
			whitelist = true;
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
	simulation({ backups, healthChecks, restrict, ongoing, runs, finishTime, whitelist, cost });
}
main().catch((err) => {
	console.error(err);
	process.exit(1);
});
