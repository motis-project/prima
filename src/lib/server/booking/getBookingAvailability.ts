import { MAX_TRAVEL, WGS84 } from '$lib/constants';
import { Interval } from '$lib/server/util/interval';
import type { Coordinates } from '$lib/util/Coordinates';
import { sql, type ExpressionBuilder, type Transaction } from 'kysely';
import type { Capacities } from './Capacities';
import { db, type Database } from '$lib/server/db';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { covers } from '$lib/server/db/covers';
import { toBusStopWithISOStrings } from './BusStop';

const selectEvents = (eb: ExpressionBuilder<Database, 'tour'>) => {
	return jsonArrayFrom(
		eb
			.selectFrom('event')
			.innerJoin('request', 'event.request', 'request.id')
			.whereRef('request.tour', '=', 'tour.id')
			.select([
				'tour.id as tourId',
				'tour.arrival',
				'tour.departure',
				'event.id',
				'event.communicatedTime',
				'event.scheduledTimeStart',
				'event.scheduledTimeEnd',
				'event.lat',
				'event.lng',
				'request.passengers',
				'request.bikes',
				'request.luggage',
				'request.wheelchairs',
				'event.isPickup',
				'event.prevLegDuration',
				'event.nextLegDuration',
				'event.eventGroup'
			])
	).as('events');
};

const selectTours = (eb: ExpressionBuilder<Database, 'vehicle'>, interval: Interval) => {
	return jsonArrayFrom(
		eb
			.selectFrom('tour')
			.whereRef('tour.vehicle', '=', 'vehicle.id')
			.where((eb) =>
				eb.and([
					eb('tour.departure', '<=', interval.endTime),
					eb('tour.arrival', '>=', interval.startTime)
				])
			)
			.select((eb) => ['tour.id', 'tour.departure', 'tour.arrival', selectEvents(eb)])
	).as('tours');
};

const selectAvailabilities = (eb: ExpressionBuilder<Database, 'vehicle'>, interval: Interval) => {
	return jsonArrayFrom(
		eb
			.selectFrom('availability')
			.whereRef('availability.vehicle', '=', 'vehicle.id')
			.where((eb) =>
				eb.and([
					eb('availability.startTime', '<=', interval.endTime),
					eb('availability.endTime', '>=', interval.startTime)
				])
			)
			.select(['availability.startTime', 'availability.endTime'])
	).as('availabilities');
};

const selectVehicles = (
	eb: ExpressionBuilder<Database, 'company'>,
	expandedSearchInterval: Interval,
	twiceEpandedSearchInterval: Interval,
	requestCapacities: Capacities
) => {
	return jsonArrayFrom(
		eb
			.selectFrom('vehicle')
			.whereRef('vehicle.company', '=', 'company.id')
			.where((eb) =>
				eb.and([
					eb('vehicle.wheelchairs', '>=', requestCapacities.wheelchairs),
					eb('vehicle.bikes', '>=', requestCapacities.bikes),
					eb('vehicle.passengers', '>=', requestCapacities.passengers),
					eb(
						'vehicle.luggage',
						'>=',
						sql<number>`cast(${requestCapacities.passengers} as integer) + cast(${requestCapacities.luggage} as integer) - ${eb.ref('vehicle.passengers')}`
					)
				])
			)
			.select((eb) => [
				'vehicle.id',
				'vehicle.bikes',
				'vehicle.luggage',
				'vehicle.wheelchairs',
				'vehicle.passengers',
				selectTours(eb, twiceEpandedSearchInterval),
				selectAvailabilities(eb, expandedSearchInterval)
			])
	).as('vehicles');
};

const selectCompanies = (
	eb: ExpressionBuilder<Database, 'company' | 'zone'>,
	expandedSearchInterval: Interval,
	twiceEpandedSearchInterval: Interval,
	requestCapacities: Capacities
) => {
	return jsonArrayFrom(
		eb
			.selectFrom('company')
			.whereRef('company.zone', '=', 'zone.id')
			.where((eb) =>
				eb.and([
					eb('company.lat', 'is not', null),
					eb('company.lng', 'is not', null),
					eb('company.address', 'is not', null),
					eb('company.name', 'is not', null),
					eb('company.zone', 'is not', null)
				])
			)
			.select([
				'company.lat',
				'company.lng',
				'company.id',
				'company.zone',
				selectVehicles(eb, expandedSearchInterval, twiceEpandedSearchInterval, requestCapacities)
			])
	).as('companies');
};

const createVehicle = (v: DbVehicle, expandedSearchInterval: Interval) => {
	const tours = v.tours.filter((tour) =>
		expandedSearchInterval.overlaps(new Interval(tour.departure, tour.arrival))
	);
	const toursBefore = v.tours.filter((tour) => tour.arrival < expandedSearchInterval.startTime);
	const toursAfter = v.tours.filter((tour) => tour.departure > expandedSearchInterval.endTime);
	const createEvent = (e: DbEvent): DbEvent & { time: Interval } => {
		return { ...e, time: new Interval(e.scheduledTimeStart, e.scheduledTimeEnd) };
	};
	return {
		...v,
		availabilities: Interval.merge(
			v.availabilities.map(
				(availbility) => new Interval(availbility.startTime, availbility.endTime)
			)
		),
		tours: tours.map((tour) => {
			return {
				arrival: tour.arrival,
				departure: tour.departure
			};
		}),
		events: tours.flatMap((t) => t.events.map((e) => createEvent(e))),
		lastEventBefore:
			toursBefore.length == 0
				? undefined
				: toursBefore
						.flatMap((tour) => tour.events.map((event) => createEvent(event)))
						.reduce((max, current) => {
							return max == undefined
								? current
								: current.communicatedTime > max.communicatedTime
									? current
									: max;
						}),
		firstEventAfter:
			toursAfter.length == 0
				? undefined
				: toursAfter
						.flatMap((tour) => tour.events.map((event) => createEvent(event)))
						.reduce((min, current) => {
							return min == undefined
								? current
								: current.communicatedTime < min.communicatedTime
									? current
									: min;
						})
	};
};

const dbQuery = async (
	userChosen: Coordinates,
	requestCapacities: Capacities,
	expandedSearchInterval: Interval,
	twiceExpandedSearchInterval: Interval,
	busStops: Coordinates[],
	trx: Transaction<Database> | undefined
) => {
	type CoordinateTable = {
		index: number;
		longitude: number;
		latitude: number;
	};
	return await (trx ?? db)
		.with('busstops', (db) => {
			const cteValues = busStops.map(
				(busStop, i) =>
					sql<string>`SELECT cast(${i} as integer) AS index, ${busStop.lat} AS lat, ${busStop.lng} AS lng`
			);
			return db
				.selectFrom(
					sql<CoordinateTable>`(${sql.join(cteValues, sql<string>` UNION ALL `)})`.as('cte')
				)
				.selectAll();
		})
		.selectFrom('zone')
		.where(covers(userChosen))
		.select((eb) => [
			selectCompanies(eb, expandedSearchInterval, twiceExpandedSearchInterval, requestCapacities),
			jsonArrayFrom(
				eb
					.selectFrom('busstops')
					.where(
						sql<boolean>`ST_Covers(zone.area, ST_SetSRID(ST_MakePoint(cast(busstops.lng as float), cast(busstops.lat as float)), ${WGS84}))`
					)
					.select(['busstops.index as busStopIndex'])
			).as('busStop')
		])
		.executeTakeFirst();
};

export type DbResult = NonNullable<Awaited<ReturnType<typeof dbQuery>>>;
export type DbVehicle = DbResult['companies'][0]['vehicles'][0];
export type DbTour = DbVehicle['tours'][0];
export type DbEvent = DbTour['events'][0];

export const getBookingAvailability = async (
	userChosen: Coordinates,
	requestCapacities: Capacities,
	searchInterval: Interval,
	busStops: Coordinates[],
	trx?: Transaction<Database>
) => {
	const expandedSearchInterval = searchInterval.expand(MAX_TRAVEL * 3, MAX_TRAVEL * 3);
	const twiceExpandedSearchInterval = searchInterval.expand(MAX_TRAVEL * 6, MAX_TRAVEL * 6);

	console.log(
		'getBookingAvailability params: ',
		JSON.stringify(
			{
				searchInterval: searchInterval.toString(),
				expandedSearchInterval: expandedSearchInterval.toString(),
				twiceExpandedSearchInterval: twiceExpandedSearchInterval.toString(),
				userChosen,
				requestCapacities,
				busStops
			},
			null,
			'\t'
		)
	);

	const dbResult = await dbQuery(
		userChosen,
		requestCapacities,
		expandedSearchInterval,
		twiceExpandedSearchInterval,
		busStops,
		trx
	);

	console.log('getBookingAvailabilty: dbResult=', JSON.stringify(dbResult, null, '\t'));

	if (!dbResult) {
		return {
			companies: [],
			filteredBusStops: []
		};
	}

	const companies = dbResult.companies
		.map((company) => {
			return {
				id: company.id,
				lat: company.lat!,
				lng: company.lng!,
				zoneId: company.zone!,
				vehicles: company.vehicles.map((v) => createVehicle(v, expandedSearchInterval))
			};
		})
		.filter((c) => c.vehicles.length != 0);
	companies.forEach((c) =>
		c.vehicles.forEach((v) => {
			v.tours.sort((t1, t2) => t1.departure - t2.departure);
			v.events.sort((e1, e2) => e1.time.startTime - e2.time.startTime);
		})
	);
	const filteredBusStops = new Array<number | undefined>(busStops.length);
	let counter = 0;
	for (let i = 0; i != busStops.length; ++i) {
		if (dbResult.busStop.find((bs) => bs.busStopIndex == i) != undefined) {
			filteredBusStops[i] = counter++;
		}
	}
	return { companies, filteredBusStops };
};

export type Company = Awaited<ReturnType<typeof getBookingAvailability>>['companies'][0];
export type VehicleWithInterval = Company['vehicles'][0];
export type Event = VehicleWithInterval['events'][0];
