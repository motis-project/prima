import { oneToMany, Direction, type BookingRequestParameters } from '$lib/api.js';
import { Coordinates, Location } from '$lib/location.js';
import { error, json } from '@sveltejs/kit';
import {} from '$lib/utils.js';
import { minutesToMs, secondsToMs } from '$lib/time_utils.js';
import { MAX_TRAVEL_DURATION, MIN_PREP_MINUTES } from '$lib/constants.js';
import {
	areChosenCoordinatesInsideAnyZone,
	bookingApiQuery,
	doesVehicleWithCapacityExist,
	type BookingApiQueryResult
} from './queries';
import { TourScheduler } from './tourScheduler';
import { computeSearchIntervals } from './searchInterval';
import type { Capacity } from '$lib/capacities';

export type ReturnType = {
	status: number;
	message: string;
};

export type SimpleEvent = {
	location: Location;
	time: Date;
};

export const POST = async (event) => {
	const customer = event.locals.user;
	if (!customer) {
		return error(403);
	}
	const parameters: BookingRequestParameters[] = JSON.parse(await event.request.json());
	if (parameters.length == 0) {
		return json({ status: 1, message: 'Es wurden keine Daten übermittelt.' }, { status: 400 });
	}
	const requiredCapacity: Capacity = {
		bikes: parameters[0].numBikes,
		luggage: parameters[0].luggage,
		wheelchairs: parameters[0].numWheelchairs,
		passengers: parameters[0].numPassengers
	};
	const requests = parameters.length;
	if(requests==0 || requests>2){
		
	}
	getValidBookings(parameters[0]);
	getValidBookings(parameters[1]);
};

const getValidBookings = async (
	p: BookingRequestParameters
) => {
	const requiredCapacity: Capacity = {
		bikes: p.numBikes,
		luggage: p.luggage,
		wheelchairs: p.numWheelchairs,
		passengers: p.numPassengers
	};
	const oneCoordinates: Coordinates = p.userChosen;
	if (p.busStops.length == 0) {
		return json({ status: 1, message: 'Es wurden keine Haltestellen angegeben.' }, { status: 400 });
	}

	let travelDurations = [];
	try {
		travelDurations = (await oneToMany(oneCoordinates, p.busStops, Direction.Forward)).map((res) =>
			secondsToMs(res.duration)
		);
	} catch (e) {
		return json({ status: 500 });
	}

	if (travelDurations.find((d) => d <= MAX_TRAVEL_DURATION) == undefined) {
		return json(
			{
				status: 2,
				message:
					'Die ausgewählten Koordinaten konnten in den Open Street Map Daten nicht zugeordnet werden.'
			},
			{ status: 400 }
		);
	}
	const results = new Array<ReturnType>(travelDurations.length);

	const maxIntervals = computeSearchIntervals(
		p.startFixed,
		p.timeStamps,
		Math.max(...travelDurations)
	);
	const earliestValidStartTime = new Date(Date.now() + minutesToMs(MIN_PREP_MINUTES));
	if (earliestValidStartTime > maxIntervals.startTimes.endTime) {
		return json(
			{
				status: 3,
				message: 'Die Anfrage verletzt die minimale Vorlaufzeit für alle Haltestellen.'
			},
			{ status: 400 }
		);
	}

	const dbResult: BookingApiQueryResult = await bookingApiQuery(
		oneCoordinates,
		requiredCapacity,
		maxIntervals.expandedSearchInterval,
		p.busStops
	);
	if (dbResult.companies.length == 0) {
		return determineError(oneCoordinates, requiredCapacity);
	}

	for (let index = 0; index != travelDurations.length; ++index) {
		const travelDuration = travelDurations[index];
		if (travelDuration > MAX_TRAVEL_DURATION) {
			results[index] = {
				status: 6,
				message:
					'Die Koordinaten der Haltestelle konnten in den Open Street Map Daten nicht zugeordnet werden.'
			};
			continue;
		}
		const intervals = computeSearchIntervals(p.startFixed, p.timeStamps, travelDuration);
		const possibleStartTimes = intervals.startTimes;
		if (earliestValidStartTime > possibleStartTimes.endTime) {
			results[index] = {
				status: 7,
				message: 'Die Anfrage verletzt die minimale Vorlaufzeit für diese Haltestelle.'
			};
			continue;
		}
		const targetZones = dbResult.targetZoneIds.get(index);
		if (targetZones == undefined) {
			return json({ status: 500 });
		}
		const currentCompanies = dbResult.companies.filter(
			(c) => targetZones.find((zId) => zId == c.zoneId) != undefined
		);
		if (currentCompanies.length == 0) {
			results[index] = {
				status: 7,
				message:
					'Diese Haltestelle liegt nicht im selben Pflichtfahrgebiet wie die ausgewählten Koordinaten.'
			};
			continue;
		}
		if (earliestValidStartTime > possibleStartTimes.startTime) {
			possibleStartTimes.startTime = earliestValidStartTime;
		}
	}

	const tourConcatenations = new TourScheduler(
		p.startFixed,
		p.userChosen,
		p.busStops,
		p.timeStamps,
		travelDurations,
		dbResult.companies,
		requiredCapacity
	);
	tourConcatenations.createTourConcatenations();
};

const determineError = async (
	start: Coordinates,
	requiredCapacity: Capacity
): Promise<Response> => {
	if (!(await areChosenCoordinatesInsideAnyZone(start))) {
		return json(
			{
				status: 4,
				message:
					'Die angegebenen Koordinaten sind in keinem Pflichtfahrgebiet das vom PrimaÖV-Projekt bedient wird enthalten.'
			},
			{ status: 400 }
		);
	}
	if (!(await doesVehicleWithCapacityExist(start, requiredCapacity))) {
		return json(
			{
				status: 5,
				message:
					'Kein Unternehmen im relevanten Pflichtfahrgebiet hat ein Fahrzeug mit ausreichend Kapazität.'
			},
			{ status: 400 }
		);
	}
	return json(
		{
			status: 6,
			message:
				'Kein Unternehmen im relevanten Pflichtfahrgebiet hat ein Fahrzeug mit ausreichend Kapazität, das zwischen Start und Ende der Anfrage verfügbar ist.'
		},
		{ status: 400 }
	);
};
