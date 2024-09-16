import type { BusStop } from '$lib/busStop';
import type { Capacities } from '$lib/capacities';
import {
	MAX_PASSENGER_WAITING_TIME_PICKUP,
	MAX_PASSENGER_WAITING_TIME_DROPOFF,
	SRID
} from '$lib/constants';
import { db } from '$lib/database.js';
import { Interval } from '$lib/interval';
import { Coordinates } from '$lib/location';
import { sql, type RawBuilder } from 'kysely';

export const getViableBusStops = async (
	userChosen: Coordinates,
	busStops: BusStop[],
	startFixed: boolean,
	capacities: Capacities
): Promise<BlacklistingResult[]> => {
	interface CoordinatesTable {
		index: number;
		longitude: number;
		latitude: number;
	}
	interface TimesTable {
		busstopindex: number;
		index: number;
		starttime: Date;
		endtime: Date;
	}
	if (busStops.length == 0 || !busStops.some((b) => b.times.length != 0)) {
		return [];
	}
	const windows = new Array<Interval[]>(busStops.length);
	const busstops = new Array<Coordinates>(busStops.length);
	for (let i = 0; i != busStops.length; ++i) {
		busstops[i] = new Coordinates(busStops[i].coordinates.lat, busStops[i].coordinates.lng);
		const times: Date[] = busStops[i].times;
		windows[i] = new Array<Interval>(times.length);
		for (let j = 0; j != times.length; ++j) {
			const t = new Date(times[j]);
			windows[i][j] = new Interval(
				startFixed ? t : new Date(t.getTime() - MAX_PASSENGER_WAITING_TIME_PICKUP),
				startFixed ? new Date(t.getTime() + MAX_PASSENGER_WAITING_TIME_DROPOFF) : t
			);
			new Date(times[j]);
		}
	}

	const dbResult = await db
		.with('busstops', (db) => {
			const cteValues = busstops.map(
				(busStop, i) =>
					sql<string>`SELECT cast(${i} as integer) AS index, cast(${busStop.lat} as decimal) AS latitude, cast(${busStop.lng} as decimal) AS longitude`
			);
			return db
				.selectFrom(
					sql<CoordinatesTable>`(${sql.join(cteValues, sql<string>` UNION ALL `)})`.as('busstops')
				)
				.selectAll();
		})
		.with('times', (db) => {
			let cteValues: RawBuilder<string>[] = [];
			for (let i = 0; i != busStops.length; ++i) {
				cteValues = cteValues.concat(
					windows[i].map(
						(t, j) =>
							sql<string>`SELECT cast(${i} as integer) AS busstopindex, cast(${j} as integer) AS index, ${t.startTime} AS starttime, ${t.endTime} AS endtime`
					)
				);
			}
			return db
				.selectFrom(sql<TimesTable>`(${sql.join(cteValues, sql<string>` UNION ALL `)})`.as('times'))
				.selectAll();
		})
		.selectFrom('zone')
		.where((eb) =>
			eb.and([
				eb('zone.is_community', '=', false),
				sql<boolean>`ST_Covers(zone.area, ST_SetSRID(ST_MakePoint(${userChosen.lng}, ${userChosen.lat}), ${SRID}))`
			])
		)
		.innerJoinLateral(
			(eb) =>
				eb
					.selectFrom('busstops')
					.where(
						sql<boolean>`ST_Covers(zone.area, ST_SetSRID(ST_MakePoint(busstops.longitude, busstops.latitude), ${SRID}))`
					)
					.selectAll()
					.as('busstopzone'),
			(join) => join.onTrue()
		)
		.innerJoinLateral(
			(eb) =>
				eb
					.selectFrom('times')
					.whereRef('times.busstopindex', '=', 'busstopzone.index')
					.selectAll()
					.as('busstoptimes'),
			(join) => join.onTrue()
		)
		.where((eb) =>
			eb.and([
				eb.exists(
					eb.selectFrom('company').where((eb) =>
						eb.and([
							eb('company.zone', '=', eb.ref('zone.id')),
							eb.exists((eb) =>
								eb
									.selectFrom('vehicle')
									.whereRef('vehicle.company', '=', 'company.id')
									.where((eb) =>
										eb.and([
											eb('vehicle.seats', '>=', capacities.passengers),
											eb('vehicle.bike_capacity', '>=', capacities.bikes),
											eb('vehicle.wheelchair_capacity', '>=', capacities.wheelchairs),
											sql<boolean>`vehicle.storage_space>=cast(${capacities.luggage} as integer)+cast(${capacities.passengers} as integer)-cast(${eb.ref('vehicle.seats')} as integer)`,
											eb.or([
												eb.exists(
													eb
														.selectFrom('availability')
														.whereRef('availability.vehicle', '=', 'vehicle.id')
														.where((eb) =>
															eb.and([
																sql<boolean>`availability.start_time <= cast(busstoptimes.endtime as timestamp)`,
																sql<boolean>`availability.end_time >= cast(busstoptimes.starttime as timestamp)`
															])
														)
												),
												eb.exists(
													eb
														.selectFrom('tour')
														.whereRef('tour.vehicle', '=', 'vehicle.id')
														.where((eb) =>
															eb.and([
																sql<boolean>`tour.departure <= cast(busstoptimes.endtime as timestamp)`,
																sql<boolean>`tour.arrival >= cast(busstoptimes.starttime as timestamp)`
															])
														)
												)
											])
										])
									)
							)
						])
					)
				)
			])
		)
		.select(['busstoptimes.index as timeIndex', 'busstoptimes.busstopindex'])
		.execute();
	return dbResult;
};

type BlacklistingResult = {
	timeIndex: number;
	busstopindex: number;
};
