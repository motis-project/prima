import {
	MAX_PASSENGER_WAITING_TIME_PICKUP,
	MAX_PASSENGER_WAITING_TIME_DROPOFF,
	WGS84
} from '$lib/constants';
import { db, type Database } from '$lib/server/db';
import { covers } from '$lib/server/db/covers';
import type { ExpressionBuilder } from 'kysely';
import { sql, type RawBuilder } from 'kysely';
import type { Coordinates } from '$lib/util/Coordinates';
import type { Capacities } from '$lib/server/booking/Capacities';
import type { BusStop } from '$lib/server/booking/BusStop';

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

type TmpDatabase = Database & { busstopzone: CoordinatesTable } & { times: TimesTable };

const withBusStops = (busStops: BusStop[], startFixed: boolean) => {
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
			const busStopIntervals: RawBuilder<string>[] = busStops.flatMap((busStop, i) =>
				busStop.times.map((t, j) => {
					const startTime = startFixed ? t : t - MAX_PASSENGER_WAITING_TIME_DROPOFF;
					const endTime = !startFixed ? t : t + MAX_PASSENGER_WAITING_TIME_PICKUP;
					return sql<string>`SELECT
                    cast(${i} as INTEGER) AS bus_stop_index,
                    cast(${j} as INTEGER) AS time_index,
                    cast(${startTime} as BIGINT) AS start_time,
                    cast(${endTime} as BIGINT) AS end_time`;
				})
			);
			return db
				.selectFrom(
					sql<TimesTable>`(${sql.join(busStopIntervals, sql<string>` UNION ALL `)})`.as('times')
				)
				.selectAll();
		});
};

const doesAvailabilityExist = (eb: ExpressionBuilder<TmpDatabase, 'vehicle' | 'times'>) => {
	return eb.exists(
		eb
			.selectFrom('availability')
			.whereRef('availability.vehicle', '=', 'vehicle.id')
			.whereRef('availability.startTime', '<=', 'times.endTime')
			.whereRef('availability.endTime', '>=', 'times.startTime')
	);
};

const doesTourExist = (eb: ExpressionBuilder<TmpDatabase, 'vehicle' | 'times'>) => {
	return eb.exists(
		eb
			.selectFrom('tour')
			.whereRef('tour.vehicle', '=', 'vehicle.id')
			.where((eb) =>
				eb.and([
					eb('tour.cancelled', '=', false),
					sql<boolean>`tour.departure <= times.end_time`,
					sql<boolean>`tour.arrival >= times.start_time`
				])
			)
	);
};

const doesVehicleExist = (
	eb: ExpressionBuilder<TmpDatabase, 'company' | 'zone' | 'busstopzone' | 'times'>,
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
	eb: ExpressionBuilder<TmpDatabase, 'zone' | 'busstopzone' | 'times'>,
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
		startFixed: boolean,
		capacities: Capacities
	): Promise<BlacklistingResult[]> => {
		return withBusStops(busStops, startFixed)
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
			.innerJoin('times', 'times.busStopIndex', 'busstopzone.busStopIndex')
			.where((eb) => doesCompanyExist(eb, capacities))
			.select(['times.timeIndex as timeIndex', 'times.busStopIndex as busStopIndex'])
			.execute();
	};

	const batches = [];
	const batchSize = 50;
	let currentPos = 0;
	while (currentPos < busStops.length) {
		batches.push(
			createBatchQuery(
				userChosen,
				busStops.slice(currentPos, Math.min(currentPos + batchSize, busStops.length)),
				startFixed,
				capacities
			)
		);
		currentPos += batchSize;
	}
	const batchResponses = await Promise.all(batches);
	console.log(batchResponses);
	return batchResponses.flatMap((batchResponse, idx) =>
		batchResponse.map((r) => {
			console.log(r);
			return { timeIndex: r.timeIndex, busStopIndex: r.busStopIndex + idx * batchSize };
		})
	);
};

export type BlacklistingResult = {
	timeIndex: number;
	busStopIndex: number;
};
