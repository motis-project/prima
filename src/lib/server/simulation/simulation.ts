#!/usr/bin/env ts-node

import 'dotenv/config';
import { addAvailability } from '$lib/server/addAvailability';
import { getToursWithRequests } from '$lib/server/db/getTours';
import { type Coordinates } from '$lib/util/Coordinates';
import { DAY } from '$lib/util/time';
import { healthCheck } from '$lib/server/util/healthCheck';
import { healthCheck as healthCheckRideShare } from '$lib/server/util/healthCheckRideShare';
import { bookFull } from './actions/bookingFull';
import { cancelRequestLocal } from './actions/cancelRequestLocal';
import { cancelTourLocal } from './actions/cancelTourLocal';
import { moveTourLocal } from './actions/moveTourLocal';
import { addRideShareTourLocal } from './actions/addRideShareTourLocal';
import { acceptRideShareRequestLocal } from './actions/acceptRideShareRequestLocal';
import { cancelRequestRsLocal } from './actions/cancelRequestRsLocal';
import { cancelTourRsLocal } from './actions/cancelTourRsLocal';
import { readCoordinates } from './readCoordinates';
import { doBackup } from './doBackup';
import { db } from '../db';
import { sql } from 'kysely';
import { createJsonlTimeStatWriter as createJsonlStatWriter } from './stats';
import { clearDatabase, Zone, addCompany, addTaxi } from '$lib/testHelpers';
import { randomInt } from './randomInt';
import type { Capacities } from '$lib/util/booking/Capacities';
import { isSamePlace } from '../booking/isSamePlace';

const FLUSH_INTERVAL = 10;
const OUTPUT_FILE = './simulation-stats.jsonl';

let counter = 0;

export type ActionResponse = {
	lastActionSpecifics: { vehicleId: number; dayStart: number } | null;
	atomicDurations: Record<string, number>;
	success: boolean;
	error: boolean;
};

enum Action {
	BOOKING_FULL,
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
	fnc: (
		coordinates: Coordinates[],
		restrictedCoordinates: Coordinates[] | undefined,
		mode?: string,
		compareCosts?: boolean,
		doWhitelist?: boolean
	) => Promise<ActionResponse>;
};

const actionProbabilities: ActionType[] = [
	{ action: Action.BOOKING_FULL, probability: 0, text: 'booking_full', fnc: bookFull },
	{ action: Action.BOOKING, probability: 0.375, text: 'booking', fnc: bookFull },
	{
		action: Action.CANCEL_REQUEST,
		probability: 0.025,
		text: 'cancel request',
		fnc: cancelRequestLocal
	},
	{ action: Action.CANCEL_TOUR, probability: 0.025, text: 'cancel tour', fnc: cancelTourLocal },
	{ action: Action.MOVE_TOUR, probability: 0.05, text: 'move tour', fnc: moveTourLocal },
	{
		action: Action.ADD_RIDE_SHARE_TOUR,
		probability: 0.05,
		text: 'add ride share tour',
		fnc: addRideShareTourLocal
	},
	{ action: Action.BOOK_RIDE_SHARE, probability: 0.125, text: 'book ride share', fnc: bookFull },
	{
		action: Action.ACCPEPT_RIDE_SHARE_TOUR,
		probability: 0.3,
		text: 'accept ride share',
		fnc: acceptRideShareRequestLocal
	},
	{
		action: Action.CANCEL_REQUEST_RS,
		probability: 0.025,
		text: 'cancel request rs',
		fnc: cancelRequestRsLocal
	},
	{
		action: Action.CANCEL_TOUR_RS,
		probability: 0.025,
		text: 'cancel tour rs',
		fnc: cancelTourRsLocal
	},
	{ action: Action.PUBLIC_TRANSPORT, probability: 0, text: 'public transport', fnc: bookFull }
];

async function addInitialAvailabilities(company: number, vehicle: number) {
	console.log('adding avas', { company }, { vehicle });
	await addAvailability(Date.now(), Date.now() + DAY * 14, vehicle, company);
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

type Params = {
	backups?: boolean;
	healthChecks?: boolean;
	restrict?: boolean;
	ongoing?: boolean;
	runs?: number;
	finishTime?: number;
	whitelist?: boolean;
	cost?: boolean;
	mode?: string;
	full: boolean;
	companies: number;
	vehiclesPerCompany: number;
};

async function setup(params: Params) {
	adjustToParams(params);
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
	await clearDatabase();
	const pickedCoordinates: Coordinates[] = [];
	for (let i = 0; i != params.companies; ++i) {
		let pickCoordinates = coordinates[randomInt(0, coordinates.length)];
		while (pickedCoordinates.some((c) => isSamePlace(pickCoordinates, c))) {
			pickCoordinates = coordinates[randomInt(0, coordinates.length)];
		}
		await addCompanyLocal(params.vehiclesPerCompany, pickCoordinates);
	}
	return { coordinates, restrictedCoordinates };
}

const capacaties: Capacities = { passengers: 3, luggage: 4, bikes: 0, wheelchairs: 1 };

async function addCompanyLocal(vehicles: number, c: Coordinates) {
	const companyId = await addCompany(Zone.WEIßWASSER, c);
	for (let i = 0; i != vehicles; ++i) {
		const taxiId = await addTaxi(companyId, capacaties);
		await addInitialAvailabilities(companyId, taxiId);
	}
}

function adjustToParams(params: Params) {
	const probabilitySum = actionProbabilities.reduce((sum, curr) => sum + curr.probability, 0);
	if (Math.abs(probabilitySum - 1) > 0.00000001) {
		console.log('The probabilities in actionProbabilies must add to 1 exactly. ', {
			probabilitySum
		});
		process.exit(1);
	}
	const summedBookingProbability = actionProbabilities
		.filter((a) => a.action === Action.BOOKING || a.action === Action.BOOKING_FULL)
		.reduce((prev, curr) => (prev += curr.probability), 0);
	actionProbabilities.find((a) => a.action === Action.BOOKING_FULL)!.probability = 0;
	actionProbabilities.find((a) => a.action === Action.BOOKING)!.probability =
		summedBookingProbability;
	if (params.full) {
		actionProbabilities.find((a) => a.action === Action.BOOKING)!.probability = 0;
		actionProbabilities.find((a) => a.action === Action.BOOKING_FULL)!.probability =
			summedBookingProbability;
	}
	if (params.mode !== undefined) {
		setActionProbabilities(params.mode);
	}
}

export async function simulation(params: Params): Promise<boolean> {
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
		let lastActionSpecifics: { vehicleId: number; dayStart: number } | null = null;
		let result: ActionResponse | undefined = undefined;
		try {
			const mode =
				action.action === Action.BOOK_RIDE_SHARE
					? 'RIDE_SHARING'
					: action.action === Action.BOOKING_FULL
						? 'ODM'
						: undefined;
			const start = performance.now();
			result = await action.fnc(
				coordinates,
				restrictedCoordinates,
				mode,
				params.cost,
				params.whitelist
			);
			const end = performance.now();
			if (result.error === true) {
				return true;
			}
			console.log('');
			if (result.success) {
				lastDbState = await getDbState();
			}
			await timeStats.record({
				...lastDbState,
				iteration: i,
				action: action.text,
				durationMs: end - start,
				atomicDurations: result.atomicDurations,
				success: result.success
			});
			if (result.success) {
				lastActionSpecifics = result.lastActionSpecifics!;
				if (
					params.healthChecks && lastActionWasRideShare(actionIdx)
						? await healthCheckRideShare()
						: await healthCheck(lastActionSpecifics.vehicleId, lastActionSpecifics.dayStart)
				) {
					await timeStats.close();
					return true;
				}
			}
		} catch (e) {
			errors.push(JSON.stringify(e, null, 2));
		}
		if (params.backups) {
			await doBackup(++counter);
		}
	}

	const timeStats = createJsonlStatWriter(OUTPUT_FILE, FLUSH_INTERVAL);
	let lastDbState = await getDbState();
	await timeStats.init();
	const { coordinates, restrictedCoordinates } = await setup(params);
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
	await timeStats.close();
	return false;
}

function lastActionWasRideShare(idx: number) {
	return (
		actionProbabilities[idx].action === Action.ADD_RIDE_SHARE_TOUR ||
		actionProbabilities[idx].action === Action.BOOK_RIDE_SHARE ||
		actionProbabilities[idx].action === Action.ACCPEPT_RIDE_SHARE_TOUR
	);
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
		Action.BOOKING_FULL,
		Action.BOOK_RIDE_SHARE,
		Action.CANCEL_REQUEST,
		Action.CANCEL_TOUR,
		Action.MOVE_TOUR,
		Action.PUBLIC_TRANSPORT,
		Action.CANCEL_REQUEST_RS,
		Action.CANCEL_TOUR_RS
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
			setActionProbability(0.9, Action.BOOKING_FULL);
			setActionProbability(0.025, Action.CANCEL_REQUEST);
			setActionProbability(0.025, Action.CANCEL_TOUR);
			setActionProbability(0.05, Action.MOVE_TOUR);
			break;
		case 'pt':
			setActionProbability(1, Action.PUBLIC_TRANSPORT);
			break;
		case 'taxionly':
			setActionProbability(1, Action.BOOKING_FULL);
			break;
	}
	console.log('Updated action probabilities:', JSON.stringify(actionProbabilities));
}

export type DbState = {
	requestsTaxi: {
		total: number;
		cancelled: number;
		active: number;
	};
	requestsRideShare: {
		total: number;
		cancelled: number;
		active: number;
	};

	tours: {
		total: number;
		cancelled: number;
		active: number;
	};

	rideShareTours: {
		total: number;
		cancelled: number;
		active: number;
	};
};

export type SimulationStats = {
	iteration: number;
	action: string;

	durationMs: number;
	atomicDurations: Record<string, number>;
	success: boolean;
} & DbState;

async function getDbState() {
	const [
		requestsTotalTaxi,
		requestsTotalRideShare,
		requestsCancelledTaxi,
		requestsCancelledRideShare,
		toursTotal,
		toursCancelled,
		rideShareTotal,
		rideShareCancelled
	] = await Promise.all([
		db
			.selectFrom('request')
			.where('request.tour', 'is not', null)
			.select(sql<number>`count(*)`.as('count'))
			.executeTakeFirstOrThrow(),
		db
			.selectFrom('request')
			.where('request.rideShareTour', 'is not', null)
			.select(sql<number>`count(*)`.as('count'))
			.executeTakeFirstOrThrow(),

		db
			.selectFrom('request')
			.where('cancelled', '=', true)
			.where('request.tour', 'is not', null)
			.select(sql<number>`count(*)`.as('count'))
			.executeTakeFirstOrThrow(),
		db
			.selectFrom('request')
			.where('cancelled', '=', true)
			.where('request.rideShareTour', 'is not', null)
			.select(sql<number>`count(*)`.as('count'))
			.executeTakeFirstOrThrow(),

		db
			.selectFrom('tour')
			.select(sql<number>`count(*)`.as('count'))
			.executeTakeFirstOrThrow(),

		db
			.selectFrom('tour')
			.where('cancelled', '=', true)
			.select(sql<number>`count(*)`.as('count'))
			.executeTakeFirstOrThrow(),

		db
			.selectFrom('rideShareTour')
			.select(sql<number>`count(*)`.as('count'))
			.executeTakeFirstOrThrow(),

		db
			.selectFrom('rideShareTour')
			.where('cancelled', '=', true)
			.select(sql<number>`count(*)`.as('count'))
			.executeTakeFirstOrThrow()
	]);

	return {
		requestsTaxi: {
			total: Number(requestsTotalTaxi.count),
			cancelled: Number(requestsCancelledTaxi.count),
			active: Number(requestsTotalTaxi.count) - Number(requestsCancelledTaxi.count)
		},
		requestsRideShare: {
			total: Number(requestsTotalRideShare.count),
			cancelled: Number(requestsCancelledRideShare.count),
			active: Number(requestsTotalRideShare.count) - Number(requestsCancelledRideShare.count)
		},
		tours: {
			total: Number(toursTotal.count),
			cancelled: Number(toursCancelled.count),
			active: Number(toursTotal.count) - Number(toursCancelled.count)
		},
		rideShareTours: {
			total: Number(rideShareTotal.count),
			cancelled: Number(rideShareCancelled.count),
			active: Number(rideShareTotal.count) - Number(rideShareCancelled.count)
		}
	};
}
