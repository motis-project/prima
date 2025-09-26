import {
	WGS84,
	EARLIEST_SHIFT_START,
	LATEST_SHIFT_END,
	MAX_PASSENGER_WAITING_TIME_PICKUP,
	MAX_PASSENGER_WAITING_TIME_DROPOFF
} from '$lib/constants';
import { db, type Database } from '$lib/server/db';
import { covers } from '$lib/server/db/covers';
import type { ExpressionBuilder } from 'kysely';
import { sql, type RawBuilder } from 'kysely';
import type { Coordinates } from '$lib/util/Coordinates';
import type { Capacities } from '$lib/util/booking/Capacities';
import type { BusStop } from '$lib/server/booking/taxi/BusStop';
import { Interval } from '$lib/util/interval';
import { getAllowedTimes } from '$lib/util/getAllowedTimes';
import { jsonArrayFrom } from 'kysely/helpers/postgres';

interface CoordinatesTable {
	bus_stop_index: number;
	lat: number;
	lng: number;
}

type TimesTable = {
	bus_stop_index: number;
	time_index: number;
	startTime: number;
	endTime: number;
};

type TmpDatabase = Database & { busstopzone: CoordinatesTable } & { times_taxi: TimesTable } & {
	times_ride_share: TimesTable;
};

const withBusStops = (
	busStops: BusStop[],
	busStopIntervalsRideShare: Interval[][],
	busStopIntervalsTaxi: Interval[][]
) => {
	return db
		.with('busstops', (db) => {
			const busStopsSelect = busStops.map(
				(busStop, i) =>
					sql<string>`SELECT
									cast(${i} as INTEGER) AS bus_stop_index,
									cast(${busStop.lat} as decimal) AS lat,
									cast(${busStop.lng} as decimal) AS lng`
			);
			return db
				.selectFrom(
					sql<CoordinatesTable>`(${sql.join(busStopsSelect, sql<string>` UNION ALL `)})`.as(
						'busstops'
					)
				)
				.selectAll();
		})
		.with('times_taxi', (db) => {
			const busStopIntervalSelect: RawBuilder<string>[] = busStopIntervalsTaxi.flatMap(
				(busStop, i) =>
					busStop.map((t, j) => {
						return sql<string>`SELECT
					 cast(${i} as INTEGER) AS bus_stop_index,
					 cast(${j} as INTEGER) AS time_index,
					 cast(${t.startTime} as BIGINT) AS start_time,
					 cast(${t.endTime} as BIGINT) AS end_time`;
					})
			);
			return db
				.selectFrom(
					sql<TimesTable>`(${sql.join(busStopIntervalSelect, sql<string>` UNION ALL `)})`.as(
						'times_taxi'
					)
				)
				.selectAll();
		})
		.with('times_ride_share', (db) => {
			const busStopIntervalSelect: RawBuilder<string>[] = busStopIntervalsRideShare.flatMap(
				(busStop, i) =>
					busStop.map((t, j) => {
						return sql<string>`SELECT
					 cast(${i} as INTEGER) AS bus_stop_index,
					 cast(${j} as INTEGER) AS time_index,
					 cast(${t.startTime} as BIGINT) AS start_time,
					 cast(${t.endTime} as BIGINT) AS end_time`;
					})
			);
			return db
				.selectFrom(
					sql<TimesTable>`(${sql.join(busStopIntervalSelect, sql<string>` UNION ALL `)})`.as(
						'times_ride_share'
					)
				)
				.selectAll();
		});
};

const doesAvailabilityExist = (eb: ExpressionBuilder<TmpDatabase, 'vehicle' | 'times_taxi'>) => {
	return eb.exists(
		eb
			.selectFrom('availability')
			.whereRef('availability.vehicle', '=', 'vehicle.id')
			.whereRef('availability.startTime', '<=', 'times_taxi.endTime')
			.whereRef('availability.endTime', '>=', 'times_taxi.startTime')
	);
};

const doesTourExist = (eb: ExpressionBuilder<TmpDatabase, 'vehicle' | 'times_taxi'>) => {
	return eb.exists(
		eb
			.selectFrom('tour')
			.whereRef('tour.vehicle', '=', 'vehicle.id')
			.where((eb) =>
				eb.and([
					eb('tour.cancelled', '=', false),
					sql<boolean>`tour.departure <= times_taxi.end_time`,
					sql<boolean>`tour.arrival >= times_taxi.start_time`
				])
			)
	);
};

const doesVehicleExist = (
	eb: ExpressionBuilder<TmpDatabase, 'company' | 'zone' | 'busstopzone' | 'times_taxi'>,
	capacities: Capacities
) => {
	return eb.exists((eb) =>
		eb
			.selectFrom('vehicle')
			.whereRef('vehicle.company', '=', 'company.id')
			.where((eb) =>
				eb.and([
					eb('vehicle.passengers', '>=', capacities.passengers),
					eb('vehicle.bikes', '>=', capacities.bikes),
					eb('vehicle.wheelchairs', '>=', capacities.wheelchairs),
					sql<boolean>`"vehicle"."luggage" >= cast(${capacities.luggage} as integer) + cast(${capacities.passengers} as integer) - cast(${eb.ref('vehicle.passengers')} as integer)`,
					eb.or([doesAvailabilityExist(eb), doesTourExist(eb)])
				])
			)
	);
};

const doesCompanyExist = (
	eb: ExpressionBuilder<TmpDatabase, 'zone' | 'busstopzone' | 'times_taxi'>,
	capacities: Capacities
) => {
	return eb.exists(
		eb
			.selectFrom('company')
			.where((eb) =>
				eb.and([eb('company.zone', '=', eb.ref('zone.id')), doesVehicleExist(eb, capacities)])
			)
	);
};

function rideShareTourExists(
	eb: ExpressionBuilder<TmpDatabase, 'rideShareVehicle' | 'rideShareTour'>
) {
	return eb.exists(eb.selectFrom('times_ride_share')
		.whereRef('rideShareTour.earliestStart', '<=', 'times_ride_share.endTime')
		.whereRef('rideShareTour.latestEnd', '>=', 'times_ride_share.startTime')
	);
}

export const getViableBusStops = async (
	userChosen: Coordinates,
	busStops: BusStop[],
	startFixed: boolean,
	capacities: Capacities
): Promise<BlacklistingResult[]> => {
	if (busStops.length == 0 || !busStops.some((b) => b.times.length != 0)) {
		return [];
	}

	const createBatchQuery = (
		userChosen: Coordinates,
		busStops: BusStop[],
		busStopIntervalsRideShare: Interval[][],
		busStopIntervalsTaxi: Interval[][],
		capacities: Capacities
	): Promise<{ taxi: BlacklistingResult[]; ride_share: BlacklistingResult[] } | undefined> => {
		if (!busStopIntervalsRideShare.some((x) => x.length !== 0)) {
			return Promise.resolve({ taxi: [], ride_share: [] });
		}
		return withBusStops(busStops, busStopIntervalsRideShare, busStopIntervalsTaxi)
			.selectFrom('busstops')
			.select((eb) => [
				jsonArrayFrom(
					eb
						.selectFrom('zone')
						.where(covers(userChosen))
						.innerJoinLateral(
							(eb) =>
								eb
									.selectFrom('busstops')
									.where(
										sql<boolean>`ST_Covers(zone.area, ST_SetSRID(ST_MakePoint(busstops.lng, busstops.lat), ${WGS84}))`
									)
									.selectAll()
									.as('busstopzone'),
							(join) => join.onTrue()
						)
						.innerJoin('times_taxi', 'times_taxi.bus_stop_index', 'busstopzone.bus_stop_index')
						.where((eb) => doesCompanyExist(eb, capacities))
						.select([
							sql<number>`times_taxi.time_index`.as('time_index'),
							sql<number>`times_taxi.bus_stop_index`.as('bus_stop_index')
						])
				).as('taxi'),
				jsonArrayFrom(
					eb
						.selectFrom('rideShareVehicle')
						.innerJoin('rideShareTour', 'rideShareTour.vehicle', 'rideShareVehicle.id')
						.where('rideShareVehicle.passengers', '>=', capacities.passengers)
						.where((eb) => sql<boolean>`"rideShareVehicle"."luggage" >= cast(${capacities.luggage} as integer) + cast(${capacities.passengers} as integer) - cast(${eb.ref('rideShareVehicle.passengers')} as integer)`)
						.where((eb) => rideShareTourExists(eb))
						.select([
							sql<number>`times_ride_share.time_index`.as('time_index'),
							sql<number>`times_ride_share.bus_stop_index`.as('bus_stop_index')
						])
				).as('ride_share')
			])
			.executeTakeFirst();
	};

	// Find the smallest Interval containing all availabilities and tours of the companies received as a parameter.
	let earliest = Number.MAX_VALUE;
	let latest = 0;
	const busStopIntervalsRideShare = busStops.map((b) =>
		b.times.map(
			(t) =>
				new Interval(
					startFixed ? t : t - MAX_PASSENGER_WAITING_TIME_DROPOFF,
					!startFixed ? t : t + MAX_PASSENGER_WAITING_TIME_PICKUP
				)
		)
	);
	busStopIntervalsRideShare.forEach((b) =>
		b.forEach((i) => {
			if (i.startTime < earliest) {
				earliest = i.startTime;
			}
			if (i.endTime > latest) {
				latest = i.endTime;
			}
		})
	);
	if (earliest >= latest) {
		return [];
	}
	const allowedTimes = getAllowedTimes(earliest, latest, EARLIEST_SHIFT_START, LATEST_SHIFT_END);
	const busStopIntervalsTaxi = busStopIntervalsRideShare.map((b) =>
		b.map((t) => {
			const allowed = Interval.intersect(allowedTimes, [t]);
			console.assert(
				allowed.length < 2,
				'Intersecting an array of intervals with a second array of intervals with only one entry produced an array of more than one interval in viableBusStops.'
			);
			return allowed.length === 0 ? new Interval(0, 0) : allowed[0];
		})
	);

	const batches = [];
	const batchSize = 50;
	let currentPos = 0;
	while (currentPos < busStops.length) {
		batches.push(
			createBatchQuery(
				userChosen,
				busStops.slice(currentPos, Math.min(currentPos + batchSize, busStops.length)),
				busStopIntervalsRideShare.slice(
					currentPos,
					Math.min(currentPos + batchSize, busStops.length)
				),
				busStopIntervalsTaxi.slice(currentPos, Math.min(currentPos + batchSize, busStops.length)),
				capacities
			)
		);
		currentPos += batchSize;
	}
	const batchResponses = await Promise.all(batches);
	const response = batchResponses
		.filter((batchResponse) => batchResponse !== undefined)
		.flatMap((batchResponse, idx) => [
			...new Set(
				batchResponse.taxi
					.map((rTaxi) => {
						return {
							time_index: rTaxi.time_index,
							bus_stop_index: rTaxi.bus_stop_index + idx * batchSize
						};
					})
					.concat(
						batchResponse.ride_share.map((rRideShare) => {
							return {
								time_index: rRideShare.time_index,
								bus_stop_index: rRideShare.bus_stop_index + idx * batchSize
							};
						})
					)
			)
		]);
	console.log('BLACKLIST QUERY RESULT: ', JSON.stringify(response, null, '\t'));
	return response;
};

export type BlacklistingResult = {
	time_index: number;
	bus_stop_index: number;
};
