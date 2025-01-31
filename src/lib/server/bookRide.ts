import { MAX_TRAVEL, MIN_PREP } from '$lib/constants';
import { oneToManyCarRouting } from '$lib/util/oneToManyCarRouting';
import type { Translations } from '$lib/i18n/translation';
import { HOUR, SECOND } from '$lib/util/time';
import { Interval } from '$lib/server/util/interval';
import { db } from './db';
import { covers } from './db/covers';
import { groupBy } from '$lib/server/util/groupBy';
import { updateValues } from '$lib/server/util/updateValues';
import { sql } from 'kysely';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';

export type LngLatAddress = {
	lat: number;
	lng: number;
	address: string;
};

export type BookingRequest = {
	customer: number;
	from: LngLatAddress;
	to: LngLatAddress;
	startFixed: boolean;
	time: UnixtimeMs;
	nPassengers: number;
	nWheelchairs: number;
	nBikes: number;
	nLuggage: number;
};

export type Booking = {
	tourId: number;
	company: {
		id: number;
		name: string;
		lat: number;
		lng: number;
	};
	pickupTime: UnixtimeMs;
	dropoffTime: UnixtimeMs;
};

export type BookingError = { msg: keyof Translations['msg'] };

const startAndTargetShareZone = async (from: maplibregl.LngLatLike, to: maplibregl.LngLatLike) => {
	const zoneContainingStartAndDestination = await db
		.selectFrom('zone')
		.where(covers(from))
		.where(covers(to))
		.executeTakeFirst();
	return zoneContainingStartAndDestination != undefined;
};

export const bookRide = async (req: BookingRequest): Promise<Booking | BookingError> => {
	console.log('booking request', req);

	let travelDuration: number | undefined = 0;
	try {
		travelDuration = (await oneToManyCarRouting(req.from, [req.to], false))[0];
		if (travelDuration > MAX_TRAVEL) {
			return { msg: 'distanceTooLong' };
		}
	} catch {
		return { msg: 'noRouteFound' };
	}

	if (travelDuration < 30 * SECOND) {
		return { msg: 'startDestTooClose' };
	}

	if (travelDuration > MAX_TRAVEL) {
		return { msg: 'maxTravelTimeExceeded' };
	}

	const startTime = req.startFixed ? req.time : req.time - travelDuration;
	const targetTime = req.startFixed ? req.time + travelDuration : req.time;
	const travelInterval = new Interval(new Date(startTime), new Date(targetTime));

	if (Date.now() + MIN_PREP > startTime) {
		return { msg: 'minPrepTime' };
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
		.where(covers(req.from))
		.where(covers(req.to))
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
							eb('vehicle.wheelchairCapacity', '>=', req.nWheelchairs),
							eb('vehicle.bikeCapacity', '>=', req.nBikes),
							eb('vehicle.seats', '>=', req.nPassengers),
							eb('vehicle.storageSpace', '>=', req.nLuggage)
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
							eb('availability.startTime', '<=', expandedTravelInterval.endTime.getTime()),
							eb('availability.endTime', '>=', expandedTravelInterval.startTime.getTime())
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
		if (!(await startAndTargetShareZone(req.from, req.to))) {
			return { msg: 'startDestNotInSameZone' };
		}
		return { msg: 'noVehicle' };
	}

	// Group availabilities by vehicle, merge availabilities corresponding to the same vehicle,
	// filter out availabilities which don't contain the travel-interval (start-target),
	// filter out vehicles which don't have any availabilities left.
	const mergedAvailabilites = groupBy(
		dbResults,
		(a) => a.vehicle,
		(a) => new Interval(new Date(a.startTime), new Date(a.endTime))
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

	console.log('available vehicles', availableVehicles);
	if (availableVehicles.length == 0) {
		return { msg: 'noVehicle' };
	}

	// Group the data of the vehicles which are available during the travel interval by their companies,
	// extract the information needed for the motis-one_to_many requests
	const availableVehiclesByCompany = groupBy(
		availableVehicles,
		(element) => element.company,
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
		durationToStart = await oneToManyCarRouting(req.from, centralCoordinates, false);
		durationFromTarget = await oneToManyCarRouting(req.to, centralCoordinates, true);
	} catch (e) {
		console.log('car routing error', e);
		return { msg: 'routingRequestFailed' };
	}
	const fullTravelIntervals = companies.map((_, index) =>
		travelInterval.expand(durationToStart[index], durationFromTarget[index])
	);

	// Filter out vehicles which aren't available for their full-travel-interval (taxicentral-start-target-taxicentral)
	console.log('full travel intervals', fullTravelIntervals);
	const toRemoveIdxs: number[] = [];
	vehicles.forEach((companyVehicles, index) => {
		const travelIntervalTooLong = fullTravelIntervals[index].getDurationMs() > 3 * HOUR;
		const availabilityContainsTravelInterval = companyVehicles.some((vehicle) =>
			vehicle.availability.contains(fullTravelIntervals[index])
		);
		if (travelIntervalTooLong || !availabilityContainsTravelInterval) {
			console.log('vehicle ', index, ': ', {
				travelIntervalTooLong,
				availabilityContainsTravelInterval,
				travelInterval,
				companyVehicles
			});
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

	console.log('vehicle ids', vehicleIds);
	if (vehicleIds.length == 0) {
		return { msg: 'noVehicle' };
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
											fullTravelIntervals
												.at(eb.ref('vehicle.company').expressionType!)!
												.endTime.getTime()
										),
										eb(
											'tour.arrival',
											'>',
											fullTravelIntervals
												.at(eb.ref('vehicle.company').expressionType!)!
												.startTime.getTime()
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

		console.log('viable vehicles', viableVehicles);
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
					departure: bestVehicle.departure.getTime(),
					arrival: bestVehicle.arrival.getTime(),
					vehicle: bestVehicle.vehicleId!
				})
				.returning('id')
				.executeTakeFirstOrThrow()
		).id;
		const requestId = (await trx
			.insertInto('request')
			.values({
				tour: tourId!,
				passengers: req.nPassengers,
				bikes: req.nBikes,
				wheelchairs: req.nWheelchairs,
				luggage: req.nLuggage
			})
			.returning('id')
			.executeTakeFirst())!.id;
		await trx
			.insertInto('event')
			.values([
				{
					isPickup: true,
					lat: req.from.lat,
					lng: req.from.lng,
					scheduledTime: startTime,
					communicatedTime: startTime, // TODO
					address: req.from.address,
					request: requestId!,
					tour: tourId!,
					customer: req.customer
				},
				{
					isPickup: false,
					lat: req.to.lat,
					lng: req.to.lng,
					scheduledTime: targetTime,
					communicatedTime: targetTime, // TODO
					address: req.to.address,
					request: requestId!,
					tour: tourId!,
					customer: req.customer
				}
			])
			.execute();
	});

	if (tourId) {
		return {
			company: {
				id: bestVehicle!.companyId!,
				lat: bestVehicle!.companyLat!,
				lng: bestVehicle!.companyLng!,
				name: bestVehicle!.companyName!
			},
			pickupTime: startTime,
			dropoffTime: targetTime,
			tourId: tourId
		};
	}

	return { msg: 'noVehicle' };
};
