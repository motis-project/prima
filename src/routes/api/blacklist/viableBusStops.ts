import {
	MAX_PASSENGER_WAITING_TIME_PICKUP,
	MAX_PASSENGER_WAITING_TIME_DROPOFF,
	WGS84,
	EARLIEST_SHIFT_START,
	LATEST_SHIFT_END
} from '$lib/constants';
import { db, type Database } from '$lib/server/db';
import { covers } from '$lib/server/db/covers';
import type { QueryCreator } from 'kysely';
import { sql, type RawBuilder } from 'kysely';
import type { Coordinates } from '$lib/util/Coordinates';
import type { Capacities } from '$lib/util/booking/Capacities';
import type { BusStop } from '$lib/server/booking/BusStop';
import { Interval } from '$lib/util/interval';
import { getAllowedTimes } from '$lib/util/getAllowedTimes';

interface CoordinatesTable {
	busStopIndex: number;
	lat: number;
	lng: number;
}

type TimesTable = {
	busStopIndex: number;
	timeIndex: number;
	startTime: number;
	endTime: number;
};

type TmpDatabase = Database & { busstops: CoordinatesTable } & { times: TimesTable };

const withBusStops = (busStops: BusStop[], busStopIntervals: Interval[][]) => {
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
		.with('times', (db) => {
			const busStopIntervalSelect: RawBuilder<string>[] = busStopIntervals.flatMap((busStop, i) =>
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
						'times'
					)
				)
				.selectAll();
		});
};

const filteredVehicles = (db: QueryCreator<TmpDatabase>, capacities: Capacities) => {
	return db
		.selectFrom('zone')
		.innerJoin('company', 'company.zone', 'zone.id')
		.innerJoin('vehicle', 'vehicle.company', 'company.id')
		.where((eb) =>
			eb.and([
				eb('vehicle.passengers', '>=', capacities.passengers),
				eb('vehicle.bikes', '>=', capacities.bikes),
				eb('vehicle.wheelchairs', '>=', capacities.wheelchairs),
				sql<boolean>`"vehicle"."luggage" >= cast(${capacities.luggage} as integer) + cast(${capacities.passengers} as integer) - cast(${eb.ref('vehicle.passengers')} as integer)`
			])
		);
};

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
		busStopIntervals: Interval[][],
		capacities: Capacities
	): Promise<BlacklistingResult[]> => {
		if (!busStopIntervals.some((x) => x.length !== 0)) {
			return Promise.resolve(new Array<BlacklistingResult>());
		}
		return withBusStops(busStops, busStopIntervals)
			.with(
				(cte) => cte('filteredBusStops').materialized(),
				(db) => {
					return filteredVehicles(db, capacities)
						.innerJoin('busstops', (join) =>
							join.on(
								sql<boolean>`ST_Covers(zone.area, ST_SetSRID(ST_MakePoint(busstops.lng, busstops.lat), ${WGS84}))`
							)
						)
						.where(covers(userChosen))
						.select(['vehicle.id as vehicleId', 'busstops.busStopIndex as busStopIndex']);
				}
			)
			.selectFrom('filteredBusStops')
			.innerJoin('times', 'times.busStopIndex', 'filteredBusStops.busStopIndex')
			.leftJoin('availability', (join) =>
				join
					.onRef('availability.vehicle', '=', 'filteredBusStops.vehicleId')
					.onRef('availability.startTime', '<=', 'times.endTime')
					.onRef('availability.endTime', '>=', 'times.startTime')
			)
			.leftJoin('tour', (join) =>
				join
					.onRef('tour.vehicle', '=', 'filteredBusStops.vehicleId')
					.on(sql<boolean>`tour.cancelled IS FALSE`)
					.onRef('tour.departure', '<=', 'times.endTime')
					.onRef('tour.arrival', '>=', 'times.startTime')
			)
			.where((eb) =>
				eb.or([
					sql<boolean>`availability.vehicle IS NOT NULL`,
					sql<boolean>`tour.vehicle IS NOT NULL`
				])
			)
			.select(['times.timeIndex as timeIndex', 'times.busStopIndex as busStopIndex'])
			.distinct()
			.execute();
	};

	// Find the smallest Interval containing all availabilities and tours of the companies received as a parameter.
	let earliest = Number.MAX_VALUE;
	let latest = 0;
	let busStopIntervals = busStops.map((b) =>
		b.times.map(
			(t) =>
				new Interval(
					startFixed ? t : t - MAX_PASSENGER_WAITING_TIME_DROPOFF,
					!startFixed ? t : t + MAX_PASSENGER_WAITING_TIME_PICKUP
				)
		)
	);
	busStopIntervals.forEach((b) =>
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
	busStopIntervals = busStopIntervals.map((b) =>
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
				busStopIntervals.slice(currentPos, Math.min(currentPos + batchSize, busStops.length)),
				capacities
			)
		);
		currentPos += batchSize;
	}
	const batchResponses = await Promise.all(batches);
	const response = batchResponses.flatMap((batchResponse, idx) =>
		batchResponse.map((r) => {
			return { timeIndex: r.timeIndex, busStopIndex: r.busStopIndex + idx * batchSize };
		})
	);
	console.log('BLACKLIST QUERY RESULT: ', JSON.stringify(response, null, '\t'));
	return response;
};

export type BlacklistingResult = {
	timeIndex: number;
	busStopIndex: number;
};
