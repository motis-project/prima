import type { BookingRequestParameters } from '$lib/api';
import { MAX_PASSENGER_WAITING_TIME, SRID } from '$lib/constants';
import { db } from '$lib/database.js';
import { Interval } from '$lib/interval';
import { json } from '@sveltejs/kit';
import { sql, type RawBuilder } from 'kysely';

export const POST = async (event) => {
	interface CoordinatesTable {
		index: number;
		longitude: number;
		latitude: number;
	}
	interface TimesTable {
		busStopIndex: number;
		index: number;
		startTime: Date;
		endTime: Date;
	}
	const parameters: BookingRequestParameters = JSON.parse(await event.request.json());
	if (parameters.timeStamps.length != parameters.busStops.length) {
		return json(
			{
				message:
					'Die Anzahl der Koordinaten für ÖPNV-Haltestellen muss mit der Anzahl der relevanten Zeitenlisten übereinstimmen.'
			},
			{ status: 400 }
		);
	}
	const userChosen = parameters.userChosen;
	const allTimes: Interval[][] = parameters.timeStamps.map((timesByBusStop) =>
		timesByBusStop.map(
			(t) =>
				new Interval(
					parameters.startFixed ? t : new Date(t.getTime() - MAX_PASSENGER_WAITING_TIME),
					parameters.startFixed ? new Date(t.getTime() + MAX_PASSENGER_WAITING_TIME) : t
				)
		)
	);
	const requiredCapacity = {
		wheelchairs: parameters.numWheelchairs,
		bikes: parameters.numBikes,
		passengers: parameters.numPassengers,
		luggage: parameters.luggage
	};
	const dbResult = await db
		.with('busStops', (db) => {
			const cteValues = parameters.busStops.map(
				(busStop, i) =>
					sql<string>`SELECT cast(${i} as integer) AS index, ${busStop.lat} AS latitude, ${busStop.lng} AS longitude`
			);
			return db
				.selectFrom(
					sql<CoordinatesTable>`(${sql.join(cteValues, sql<string>` UNION ALL `)})`.as('targets')
				)
				.selectAll();
		})
		.with('times', (db) => {
			const cteValues: RawBuilder<string>[] = [];
			for (let i = 0; i != parameters.timeStamps.length; ++i) {
				cteValues.concat(
					allTimes[i].map(
						(t, j) =>
							sql<string>`SELECT cast(${i} as integer) AS busStopIndex, cast(${j} as integer) AS index, ${t.startTime} AS startTime, ${t.endTime} AS endTime`
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
		.innerJoin(
			(eb) =>
				eb
					.selectFrom('busStops')
					.where(
						sql<boolean>`ST_Covers(zone.area, ST_SetSRID(ST_MakePoint(targets.longitude, targets.latitude), ${SRID}))`
					)
					.selectAll()
					.as('busStopZone'),
			(join) => join.onTrue()
		)
		.innerJoin(
			(eb) =>
				eb
					.selectFrom('times')
					.whereRef('times.busStopIndex', '=', 'busStopZone.index')
					.selectAll()
					.as('busStopTimes'),
			(join) => join.onTrue()
		)
		.where((eb) =>
			eb.and([
				eb.exists(
					eb.selectFrom('company').where((eb) =>
						eb.and([
							eb('company.zone', '=', eb.ref('busStopZone.id')),
							eb.exists((eb) =>
								eb
									.selectFrom('vehicle')
									.whereRef('vehicle.company', '=', 'company.id')
									.where((eb) =>
										eb.and([
											eb('vehicle.seats', '>=', requiredCapacity.passengers),
											eb('vehicle.bike_capacity', '>=', requiredCapacity.bikes),
											eb('vehicle.wheelchair_capacity', '>=', requiredCapacity.wheelchairs),
											eb(
												'vehicle.storage_space',
												'>=',
												requiredCapacity.luggage +
													requiredCapacity.passengers -
													eb.ref('vehicle.seats').expressionType!
											),
											eb.or([
												eb.exists(
													eb
														.selectFrom('availability')
														.whereRef('availability.vehicle', '=', 'vehicle.id')
														.where((eb) =>
															eb.and([
																eb('availability.start_time', '<=', eb.ref('busStopTimes.endTime')),
																eb('availability.end_time', '>=', eb.ref('busStopTimes.startTime'))
															])
														)
												),
												eb.exists(
													eb
														.selectFrom('tour')
														.whereRef('tour.vehicle', '=', 'vehicle.id')
														.where((eb) =>
															eb.and([
																eb('tour.departure', '<=', eb.ref('busStopTimes.endTime')),
																eb('tour.arrival', '>=', eb.ref('busStopTimes.startTime'))
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
		.select(['busStopTimes.index as timeIndex', 'busStopTimes.busStopIndex'])
		.execute();

	return json(
		{
			body: JSON.stringify(dbResult)
		},
		{ status: 200 }
	);
};
