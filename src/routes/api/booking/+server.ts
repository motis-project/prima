import maplibregl from 'maplibre-gl';
import { covers } from '$lib/server/db/covers';
import { sql } from 'kysely';
import { db } from '$lib/server/db';
import type { RequestEvent } from './$types';
import { error, json } from '@sveltejs/kit';
import { oneToManyCarRouting } from '$lib/util/oneToManyCarRouting';
import { MAX_TRAVEL, MIN_PREP } from '$lib/constants';
import { Interval } from '$lib/util/interval';
import { HOUR } from '$lib/util/time';
import { groupBy } from '$lib/util/groupBy';
import { updateValues } from '$lib/util/updateValues';

const startAndTargetShareZone = async (from: maplibregl.LngLatLike, to: maplibregl.LngLatLike) => {
	const zoneContainingStartAndDestination = await db
		.selectFrom('zone')
		.where(covers(from))
		.where(covers(to))
		.executeTakeFirst();
	return zoneContainingStartAndDestination != undefined;
};

export const POST = async (event: RequestEvent) => {
	const customer = event.locals.session?.userId;
	if (!customer) {
		return error(403);
	}
	const { from, to, startFixed, timeStamp, numPassengers, numWheelchairs, numBikes, luggage } =
		await event.request.json();
	const time = new Date(timeStamp);

	let travelDuration: number | undefined = 0;
	try {
		travelDuration = (await oneToManyCarRouting(from.coordinates, [to.coordinates], false))[0];
		if (travelDuration > MAX_TRAVEL) {
			throw 'keine Route gefunden';
		}
	} catch (e) {
		return json(
			{
				status: 1,
				message: `Es ist ein Fehler im Routing von Start zu Ziel aufgetreten: ${e}.`
			},
			{ status: 404 }
		);
	}

	if (travelDuration == 0) {
		return json({ status: 2, message: 'Start und Ziel sind identisch.' }, { status: 404 });
	}

	if (travelDuration > MAX_TRAVEL) {
		return json(
			{ status: 3, message: 'Die maximale Fahrtzeit wurde überschritten.' },
			{ status: 404 }
		);
	}

	const startTime = startFixed ? time : new Date(time.getTime() - travelDuration);
	const targetTime = startFixed ? new Date(time.getTime() + travelDuration) : time;
	const travelInterval = new Interval(startTime, targetTime);

	if (new Date(Date.now() + MIN_PREP) > startTime) {
		return json(
			{ status: 4, message: 'Die Anfrage verletzt die minimale Vorlaufzeit.' },
			{ status: 404 }
		);
	}
	const expandedTravelInterval = travelInterval.expand(24 * HOUR, 24 * HOUR);

	// Get (unmerged) availabilities which overlap the expanded travel interval,
	// for vehicles which satisfy the zone constraints and the capacity constraints.
	// Also get some other data to reduce number of select calls to db.
	// Use expanded travel interval, to ensure that, if a vehicle is available
	// for the full travel interval (taxicentral-start-target-taxicentral),
	// the corresponding availbilities are already fetched in this select statement.
	const dbResults = await db
		.selectFrom('zone')
		.where(covers(from.coordinates))
		.where(covers(to.coordinates))
		.innerJoin('company', 'company.zone', 'zone.id')
		.where((eb) =>
			eb.and([
				eb('company.lat', 'is not', null),
				eb('company.lng', 'is not', null),
				eb('company.address', 'is not', null),
				eb('company.name', 'is not', null),
				eb('company.zone', 'is not', null)
			])
		)
		.innerJoin(
			(eb) =>
				eb
					.selectFrom('vehicle')
					.selectAll()
					.where((eb) =>
						eb.and([
							eb('vehicle.wheelchairCapacity', '>=', numWheelchairs),
							eb('vehicle.bikeCapacity', '>=', numBikes),
							eb('vehicle.seats', '>=', numPassengers),
							eb('vehicle.storageSpace', '>=', luggage)
						])
					)
					.as('vehicle'),
			(join) => join.onRef('vehicle.company', '=', 'company.id')
		)
		.innerJoin(
			(eb) =>
				eb
					.selectFrom('availability')
					.selectAll()
					.where((eb) =>
						eb.and([
							eb('availability.startTime', '<=', expandedTravelInterval.endTime),
							eb('availability.endTime', '>=', expandedTravelInterval.startTime)
						])
					)
					.as('availability'),
			(join) => join.onRef('availability.vehicle', '=', 'vehicle.id')
		)
		.select([
			'availability.startTime',
			'availability.endTime',
			'availability.vehicle',
			'company.lat',
			'company.lng',
			'company.id as company'
		])
		.execute();

	console.log('db results', dbResults);
	if (dbResults.length == 0) {
		if (!(await startAndTargetShareZone(from.coordinates, to.coordinates))) {
			return json(
				{
					status: 5,
					message: 'Start und Ziel sind nicht im selben Pflichtfahrgebiet enthalten.'
				},
				{ status: 404 }
			);
		}
		return json(
			{
				status: 6,
				message:
					'Kein Unternehmen im relevanten Pflichtfahrgebiet hat ein Fahrzeug, das zwischen Start und Ende der Anfrage verfügbar ist.'
			},
			{ status: 404 }
		);
	}

	// Group availabilities by vehicle, merge availabilities corresponding to the same vehicle,
	// filter out availabilities which don't contain the travel-interval (start-target),
	// filter out vehicles which don't have any availabilities left.
	const mergedAvailabilites = groupBy(
		dbResults,
		(element) => element.vehicle,
		(element) => new Interval(element.startTime, element.endTime)
	);
	updateValues(mergedAvailabilites, (entry) =>
		Interval.merge(entry).filter((i) => i.contains(travelInterval))
	);

	console.assert(
		Math.max(...[...mergedAvailabilites.values()].map((availabilities) => availabilities.length)) <=
		1
	);

	const availableVehicles = [...mergedAvailabilites.entries()]
		.filter(([_, availabilities]) => availabilities.length > 0)
		.map(([vehicle, availabilities]) => {
			const db_result = dbResults.find((db_r) => db_r.vehicle == vehicle);
			return {
				lat: db_result!.lat,
				lng: db_result!.lng,
				company: db_result!.company,
				availability: availabilities[0],
				vehicle
			};
		});

	if (availableVehicles.length == 0) {
		return json(
			{
				status: 7,
				message:
					'Kein Unternehmen im relevanten Pflichtfahrgebiet hat ein Fahrzeug, das zwischen Start und Ende der Anfrage verfügbar ist.'
			},
			{ status: 404 }
		);
	}

	// Group the data of the vehicles which are available during the travel interval by their companies,
	// extract the information needed for the motis-one_to_many requests
	const availableVehiclesByCompany = groupBy(
		availableVehicles,
		(element) => {
			return element.company;
		},
		(element) => {
			return {
				availability: element.availability,
				vehicle: element.vehicle,
				lat: element.lat,
				lng: element.lng
			};
		}
	);
	const buffer = [...availableVehiclesByCompany];
	const companies = buffer.map(([company, _]) => company);
	const vehicles = buffer.map(([_, vehicles]) => vehicles);
	const centralCoordinates = buffer.map(([company, _]) => {
		const vehicles = availableVehiclesByCompany.get(company);
		console.assert(vehicles && vehicles.length != 0);
		return { lat: vehicles![0].lat!, lng: vehicles![0].lng! };
	});

	let durationToStart: Array<number> = [];
	let durationFromTarget: Array<number> = [];
	try {
		durationToStart = await oneToManyCarRouting(from.coordinates, centralCoordinates, false);
		durationFromTarget = await oneToManyCarRouting(to.coordinates, centralCoordinates, true);
	} catch (e) {
		return json({ status: 8, message: `Routing Anfrage fehlgeschlagen: ${e}` }, { status: 500 });
	}
	const fullTravelIntervals = companies.map((_, index) =>
		travelInterval.expand(durationToStart[index], durationFromTarget[index])
	);

	// Filter out vehicles which aren't available for their full-travel-interval (taxicentral-start-target-taxicentral)
	const toRemoveIdxs: number[] = [];
	vehicles.forEach((companyVehicles, index) => {
		if (
			fullTravelIntervals[index].getDurationMs() > 3 * HOUR ||
			!companyVehicles.some((vehicle) => vehicle.availability.contains(fullTravelIntervals[index]))
		) {
			toRemoveIdxs.push(index);
		}
	});
	toRemoveIdxs.sort((a, b) => b - a);
	toRemoveIdxs.forEach((r) => companies.splice(r, 1));
	toRemoveIdxs.forEach((r) => vehicles.splice(r, 1));
	toRemoveIdxs.forEach((r) => fullTravelIntervals.splice(r, 1));

	const vehicleIds = vehicles.flatMap((vehicles) => vehicles.map((vehicle) => vehicle.vehicle));

	console.assert(
		vehicles.length == fullTravelIntervals.length,
		"In Booking Api, variables vehicles and fullTravelIntervals don't have the same length."
	);
	console.assert(
		vehicles.length == companies.length,
		"In Booking Api, variables vehicles and companies don't have the same length."
	);

	if (vehicleIds.length == 0) {
		return json(
			{
				status: 9,
				message:
					'Kein Unternehmen im relevanten Pflichtfahrgebiet hat ein Fahrzeug, das für die gesamte Tour mit An- und Rückfahrt durchgängig verfügbar ist.'
			},
			{ status: 404 }
		);
	}

	let tourId: number | undefined = undefined;
	let bestVehicle = undefined;

	console.log('getting viable vehicles');
	await db.transaction().execute(async (trx) => {
		sql`LOCK TABLE tour, request, event IN ACCESS EXCLUSIVE MODE;`.execute(trx);
		// Fetch data of tours corresponding to the remaining vehicles
		const viableVehicles = (
			await trx
				.selectFrom('vehicle')
				.where('vehicle.id', 'in', vehicleIds)
				.selectAll()
				.where(({ exists, not, selectFrom }) =>
					not(
						exists(
							selectFrom('tour')
								.select(['tour.arrival', 'tour.departure', 'tour.vehicle'])
								.where((eb) =>
									eb.and([
										eb('tour.vehicle', '=', eb.ref('vehicle.id')),
										eb(
											'tour.departure',
											'<',
											fullTravelIntervals.at(eb.ref('vehicle.company').expressionType!)!.endTime
										),
										eb(
											'tour.arrival',
											'>',
											fullTravelIntervals.at(eb.ref('vehicle.company').expressionType!)!.startTime
										)
									])
								)
						)
					)
				)
				.innerJoin('company', 'company.id', 'vehicle.company')
				.select([
					'vehicle.company',
					'vehicle.id as vehicle',
					'company.name as companyName',
					'company.id as companyId',
					'company.lat as companyLat',
					'company.lng as companyLng'
				])
				.execute()
		).map((v) => {
			console.log('viable vehicle: ', v);
			const companyIdx = companies.indexOf(v.company);
			return {
				companyName: v.companyName,
				companyId: v.companyId,
				companyLat: v.companyLat,
				companyLng: v.companyLng,
				vehicleId: v.vehicle,
				departure: fullTravelIntervals[companyIdx].startTime,
				arrival: fullTravelIntervals[companyIdx].endTime,
				distance: durationToStart[companyIdx] + durationFromTarget[companyIdx]
			};
		});

		if (viableVehicles.length == 0) {
			return;
		}

		// Sort companies by the distance of their taxi-central to start + target
		viableVehicles.sort((a, b) => a.distance - b.distance);
		bestVehicle = viableVehicles[0];

		// Write tour, request, 2 events and if not existant address in db.
		tourId = (
			await trx
				.insertInto('tour')
				.values({
					departure: bestVehicle.departure,
					arrival: bestVehicle.arrival,
					vehicle: bestVehicle.vehicleId!
				})
				.returning('id')
				.executeTakeFirstOrThrow()
		).id;
		const requestId = (await trx
			.insertInto('request')
			.values({
				tour: tourId!,
				passengers: numPassengers,
				bikes: numBikes,
				wheelchairs: numWheelchairs,
				luggage
			})
			.returning('id')
			.executeTakeFirst())!.id;
		await trx
			.insertInto('event')
			.values([
				{
					isPickup: true,
					lat: from.coordinates.lat,
					lng: to.coordinates.lng,
					scheduledTime: startTime,
					communicatedTime: startTime, // TODO
					address: from.address,
					request: requestId!,
					tour: tourId!,
					customer
				},
				{
					isPickup: false,
					lat: to.coordinates.lat,
					lng: to.coordinates.lng,
					scheduledTime: targetTime,
					communicatedTime: targetTime, // TODO
					address: to.address,
					request: requestId!,
					tour: tourId!,
					customer
				}
			])
			.execute();
	});


	if (tourId) {
		console.log('booking successful: ', tourId);
		return json({
			status: 0,
			companyId: bestVehicle!.companyId!,
			companyLat: bestVehicle!.companyLat!,
			companyLng: bestVehicle!.companyLng!,
			companyName: bestVehicle!.companyName!,
			pickupTime: startTime,
			dropoffTime: targetTime,
			tourId: tourId,
			message: 'Die Buchung war erfolgreich.'
		});
	}

	console.log('booking failed');
	return json(
		{
			status: 10,
			message:
				'Kein Fahrzeug ist für die gesamte Fahrtzeit verfügbar und nicht mit anderen Aufträgen beschäftigt.'
		},
		{ status: 404 }
	);
};
