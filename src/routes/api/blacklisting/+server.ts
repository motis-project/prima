import { MAX_PASSENGER_WAITING_TIME, SRID } from '$lib/constants';
import { db } from '$lib/database.js';
import { Interval } from '$lib/interval';
import type { Coordinates } from '$lib/location';
import { json } from '@sveltejs/kit';
import { sql, type RawBuilder } from 'kysely';

export const POST = async (event) => {
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
	const {userChosen, busStops,startFixed,timeStamps,numPassengers,numBikes,numWheelchairs,luggage} = await event.request.json();
	if (timeStamps.length != busStops.length) {
		return json(
			{
				message:
					'Die Anzahl der Koordinaten für ÖPNV-Haltestellen muss mit der Anzahl der relevanten Zeitenlisten übereinstimmen.'
			},
			{ status: 400 }
		);
	}
	if(timeStamps.length==0){
		return json(
			{
				message:
					'Es wurden keine Zeiten angegeben.'
			},
			{ status: 200 }
		);
	}
	const timestamps: Date[][] = new Array<Date[]>(timeStamps.length);
	for(let i=0;i!=timeStamps.length;++i){
		timestamps[i] = new Array<Date>(timeStamps[i].length);
		for(let j=0;j!=timeStamps.length;++j){
			timestamps[i][j] = new Date(timeStamps[i][j]);
		}
	}
	console.log(timeStamps);
	console.log(timestamps);
	const busstops: Coordinates[] = busStops
	const allTimes: Interval[][] = timestamps.map((timesByBusStop) =>
		timesByBusStop.map(
			(t) =>
				new Interval(
					startFixed ? t : new Date(t.getTime() - MAX_PASSENGER_WAITING_TIME),
					startFixed ? new Date(t.getTime() + MAX_PASSENGER_WAITING_TIME) : t
				)
		)
	);
	const requiredCapacity = {
		wheelchairs: numWheelchairs,
		bikes: numBikes,
		passengers: numPassengers,
		luggage: luggage
	};
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
			for (let i = 0; i != timestamps.length; ++i) {
				cteValues = cteValues.concat(
					allTimes[i].map(
						(t, j) =>
							sql<string>`SELECT cast(${i} as integer) AS busstopindex, cast(${j} as integer) AS index, ${t.startTime} AS starttime, ${t.endTime} AS endtime`
					)
				);
			}
			console.log(cteValues);
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
																eb('availability.start_time', '<=', eb.ref('busstoptimes.endtime')),
																eb('availability.end_time', '>=', eb.ref('busstoptimes.starttime'))
															])
														)
												),
												eb.exists(
													eb
														.selectFrom('tour')
														.whereRef('tour.vehicle', '=', 'vehicle.id')
														.where((eb) =>
															eb.and([
																eb('tour.departure', '<=', eb.ref('busstoptimes.endtime')),
																eb('tour.arrival', '>=', eb.ref('busstoptimes.starttime'))
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

		console.log(dbResult);

	return json(
		{
			body: JSON.stringify(dbResult)
		},
		{ status: 200 }
	);
};
