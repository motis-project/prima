import { oneToMany, Direction, getRoute } from '../../../lib/api.js';
import { Coordinates } from '../../../lib/coordinates.js';
import { db } from '$lib/database';
import { Interval } from '../../../lib/interval.js';
import { groupBy, updateValues } from '$lib/collection_utils.js';
import { json } from '@sveltejs/kit';
import {} from '$lib/utils.js';
import { hoursToMs, minutesToMs, secondsToMs } from '$lib/time_utils.js';
import { MIN_PREP_MINUTES } from '$lib/constants.js';
import { sql } from 'kysely';

export const POST = async (event) => {
	const request = event.request;
	const customer = event.locals.user;
	if(!customer){
		return error();
	}
	const customerId = customer.id;
	const { from, to, startFixed, timeStamp, numPassengers, numWheelchairs, numBikes, luggage } =
		await request.json();
	const time = new Date(timeStamp);
	const travelDuration = (
		await getRoute({
			start: { lat: from.lat, lng: from.lng, level: 0 },
			destination: { lat: to.lat, lng: to.lng, level: 0 },
			profile: 'car',
			direction: 'forward'
		})
	).metadata.duration;
	const startTime = startFixed ? time : new Date(time.getTime() - travelDuration);
	const targetTime = startFixed ? new Date(time.getTime() + travelDuration) : time;
	const travelInterval = new Interval(startTime, targetTime);
	if (new Date(Date.now() + minutesToMs(MIN_PREP_MINUTES)) > startTime) {
		console.log('Insufficient preparation time.');
		return json({});
	}
	const expandedTravelInterval = travelInterval.expand(hoursToMs(24), hoursToMs(24));

	const zones = await db
		.selectFrom('zone')
		.where('is_community', '=', false)
		.select(['id', 'area'])
		.execute();
	const start_zone_ids = zones.map((z) => z.id); //zones which contain the start and target coordinates, TODO

	if (start_zone_ids.length == 0) {
		console.log('There is no zone containing both the start and target coordinates.');
		return json({});
	}

	// Get (unmerged) availabilities which overlap the expanded travel interval, for vehicles which satisfy the zone constraints and the capacity constraints.
	// Also get some other data to reduce number of select calls to db.
	// Use expanded travel interval, to ensure that, if a vehicle is available for the full travel interval (taxicentral-start-target-taxicentral) the corresponding
	// availbilities are already fetched in this select statement.
	const db_results = await db
		.selectFrom('zone')
		.where('zone.id', 'in', start_zone_ids)
		.innerJoin('company', 'company.zone', 'zone.id')
		.where((eb) =>
			eb.and([
				eb('latitude', '!=', null),
				eb('longitude', '!=', null),
				eb('address', '!=', null),
				eb('name', '!=', null),
				eb('zone', '!=', null),
				eb('community_area', '!=', null)
			])
		)
		.innerJoin(
			(eb) =>
				eb
					.selectFrom('vehicle')
					.selectAll()
					.where((eb) =>
						eb.and([
							eb('vehicle.wheelchair_capacity', '>=', numWheelchairs),
							eb('vehicle.bike_capacity', '>=', numBikes),
							eb('vehicle.seats', '>=', numPassengers),
							eb('vehicle.storage_space', '>=', luggage)
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
							eb('availability.start_time', '<=', expandedTravelInterval.endTime),
							eb('availability.end_time', '>=', expandedTravelInterval.startTime)
						])
					)
					.as('availability'),
			(join) => join.onRef('availability.vehicle', '=', 'vehicle.id')
		)
		.select([
			'availability.start_time',
			'availability.end_time',
			'availability.vehicle',
			'company.latitude',
			'company.longitude',
			'company.id as company'
		])
		.execute();

	// Group availabilities by vehicle, merge availabilities corresponding to the same vehicle, filter out availabilities which don't contain the
	// travel-interval (start-target), filter out vehicles which don't have any availabilities left.
	const mergedAvailabilites = groupBy(
		db_results,
		(element) => element.vehicle,
		(element) => new Interval(element.start_time, element.end_time)
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
			const db_result = db_results.find((db_r) => db_r.vehicle == vehicle);
			return {
				latitude: db_result!.latitude,
				longitude: db_result!.longitude,
				company: db_result!.company,
				availability: availabilities[0],
				vehicle
			};
		});

	// Group the data of the vehicles which are available during the travel interval by their companies,
	// extract the information needed for the motis-one_to_many requests
	const availableVehiclesByCompany = groupBy(
		availableVehicles,
		(element) => {
			return  element.company;
		},
		(element) => {
			return {
				availability: element.availability,
				vehicle: element.vehicle,
				latitude: element.latitude,
				longitude: element.longitude 
			};
		}
	);
	const buffer = [...availableVehiclesByCompany];
	const companies = buffer.map(([company, _]) => company);
	const vehicles = buffer.map(([_, vehicles]) => vehicles);
	const centralCoordinates = buffer.map(
		([company, _]) => {
			const vehicles = availableVehiclesByCompany.get(company);
			console.assert(vehicles && vehicles.length != 0);
		return new Coordinates(
			vehicles![0].latitude!,
			vehicles![0].longitude!
		);
		}
	);

	// Motis-one_to_many requests
	const durationToStart = (await oneToMany(from, centralCoordinates, Direction.Backward)).map(
		(res) => secondsToMs(res.duration)
	);
	const durationFromTarget = (await oneToMany(to, centralCoordinates, Direction.Forward)).map(
		(res) => secondsToMs(res.duration)
	);

	const fullTravelIntervals = companies.map((_, index) =>
		travelInterval.expand(durationToStart[index], durationFromTarget[index])
	);

	// Filter out vehicles which aren't available for their full-travel-interval (taxicentral-start-target-taxicentral)
	const toRemoveIdxs: number[] = [];
	vehicles.forEach((companyVehicles, index) => {
		if (
			!companyVehicles.some((vehicle) => vehicle.availability.contains(fullTravelIntervals[index]))
		) {
			toRemoveIdxs.push(index);
		}
	});
	toRemoveIdxs.sort((a, b) => b - a);
	toRemoveIdxs.forEach((r) => companies.splice(r, 1));
	toRemoveIdxs.forEach((r) => vehicles.splice(r, 1));
	toRemoveIdxs.forEach((r) => fullTravelIntervals.splice(r, 1));

	const vehicleIds = vehicles.map((v) => v[0].vehicle);

	console.assert(
		vehicles.length == fullTravelIntervals.length,
		"In Booking Api, variables vehicles and fullTravelIntervals don't have the same length."
	);
	console.assert(
		vehicles.length == companies.length,
		"In Booking Api, variables vehicles and companies don't have the same length."
	);

	if (vehicleIds.length == 0) {
		console.log(
			'Noone can handle this booking request, there are no available vehicles which fulfill the zone and capacity requirements.'
		);
		return json({});
	}

	let tour_id: number | undefined = undefined;

	await db.transaction().execute(async (trx) => {
		sql`LOCK TABLE tour, request, event IN ACCESS EXCLUSIVE MODE;`.execute(trx);
		// Fetch data of tours corresponding to the remaining vehicles
		const viable_vehicles = (
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
				.select(['vehicle.company', 'vehicle.id as vehicle'])
				.execute()
		).map((v) => {
			const companyIdx = companies.indexOf(v.company);
			return {
				vehicleId: v.vehicle,
				departure: fullTravelIntervals[companyIdx].startTime,
				arrival: fullTravelIntervals[companyIdx].endTime,
				distance: durationToStart[companyIdx] + durationFromTarget[companyIdx]
			};
		});

		if (viable_vehicles.length == 0) {
			console.log(
				'Noone can handle this booking request, all available vehicles which fulfill the zone and capacity requirements are busy.'
			);
			return json({});
		}

		// Sort companies by the distance of their taxi-central to start + target
		viable_vehicles.sort((a, b) => a.distance - b.distance);

		const bestCompany = viable_vehicles[0];

		// Write tour, request and 2 events in db.
		tour_id = (await trx
			.insertInto('tour')
			.values({
				departure: bestCompany.departure,
				arrival: bestCompany.arrival,
				vehicle: bestCompany.vehicleId!
			})
			.returning('id')
			.executeTakeFirst())!.id;
		const requestId = (await trx
			.insertInto('request')
			.values({
				tour: tour_id!,
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
					is_pickup: true,
					latitude: from.lat,
					longitude: from.lng,
					scheduled_time: startTime,
					communicated_time: startTime, // TODO
					address: 1, // TODO
					request: requestId!,
					tour: tour_id!,
					customer: customerId
				},
				{
					is_pickup: false,
					latitude: to.lat,
					longitude: to.lng,
					scheduled_time: targetTime,
					communicated_time: targetTime, // TODO
					address: 1, // TODO
					request: requestId!,
					tour: tour_id!,
					customer: customerId
				}
			])
			.execute();
	});
	if (tour_id) {
		console.log('Booking request was assigned.');
		return json({ tour_id });
	}
	return json({});
};
