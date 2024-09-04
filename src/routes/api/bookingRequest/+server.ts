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
import { TourScheduler } from './tourConcatenation';
import { computeSearchIntervals } from './searchInterval';
import type { Capacity } from './capacities';
import { groupBy } from '$lib/collection_utils';

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
	const grouped = groupBy(
		parameters,
		(p) => p.startFixed,
		(p) => {
			return { location: p.startFixed ? p.to : p.from, time: new Date(p.timeStamp) };
		}
	);
	const startMany = grouped.get(false);
	if (startMany != undefined) {
		getValidBookings(parameters[0].to, startMany, false, requiredCapacity);
	}
	const targetMany = grouped.get(true)!;
	if (targetMany != undefined) {
		getValidBookings(parameters[0].from, targetMany, true, requiredCapacity);
	}
};

const getValidBookings = async (
	oneLocation: Location,
	many: SimpleEvent[],
	startFixed: boolean,
	requiredCapacity: Capacity
) => {
	const oneCoordinates: Coordinates = oneLocation.coordinates;
	if (many.length == 0) {
		return json({ status: 1, message: 'Es wurden keine Haltestellen angegeben.' }, { status: 400 });
	}
	const targets: Coordinates[] = many.map((e) => e.location.coordinates);

	let travelDurations = [];
	try {
		travelDurations = (await oneToMany(oneCoordinates, targets, Direction.Forward)).map((res) =>
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
		startFixed,
		many[0].time,
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
		targets
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
		const intervals = computeSearchIntervals(startFixed, many[index].time, travelDuration);
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

	const startMany: Coordinates[] = [];
	const targetMany: Coordinates[] = [];
	const tourConcatenations = new TourScheduler(startFixed, oneLocation.coordinates, many.map((l)=>l.location.coordinates), travelDurations, dbResult.companies, requiredCapacity);
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
