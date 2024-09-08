import { Coordinates } from '$lib/location.js';
import { Interval } from '$lib/interval.js';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { sql } from 'kysely';
import { db } from '$lib/database';
import type { ExpressionBuilder } from 'kysely';
import type { Database } from '$lib/types';
import { SRID } from '$lib/constants';
import { groupBy } from '$lib/collection_utils';
import type { Capacity } from '$lib/capacities';
import {
	joinInitializedCompaniesOnZones,
	selectZonesContainingCoordinates,
	ZoneType
} from '$lib/sqlHelpers';
import type { Company } from '$lib/compositionTypes';

export type BookingApiQueryResult = {
	companies: Company[];
	busStopZoneIds: Map<number, number[]>;
};

const selectAvailabilities = (eb: ExpressionBuilder<Database, 'vehicle'>, interval: Interval) => {
	return jsonArrayFrom(
		eb
			.selectFrom('availability')
			.whereRef('availability.vehicle', '=', 'vehicle.id')
			.where((eb) =>
				eb.and([
					eb('availability.start_time', '<=', interval.endTime),
					eb('availability.end_time', '>=', interval.startTime)
				])
			)
			.select(['availability.start_time', 'availability.end_time'])
	).as('availabilities');
};

const selectEvents = (eb: ExpressionBuilder<Database, 'tour'>) => {
	return jsonArrayFrom(
		eb
			.selectFrom('request')
			.whereRef('request.tour', '=', 'tour.id')
			.innerJoin('event', 'request.id', 'event.request')
			.select([
				'event.id',
				'event.communicated_time',
				'event.scheduled_time',
				'event.latitude',
				'event.longitude',
				'request.passengers',
				'request.bikes',
				'request.luggage',
				'request.wheelchairs',
				'event.is_pickup'
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

const selectVehicles = (
	eb: ExpressionBuilder<Database, 'company'>,
	interval: Interval,
	requiredCapacities: Capacity
) => {
	return jsonArrayFrom(
		eb
			.selectFrom('vehicle')
			.whereRef('vehicle.company', '=', 'company.id')
			.where((eb) =>
				eb.and([
					eb('vehicle.wheelchair_capacity', '>=', requiredCapacities.wheelchairs),
					eb('vehicle.bike_capacity', '>=', requiredCapacities.bikes),
					eb('vehicle.seats', '>=', requiredCapacities.passengers),
					eb(
						'vehicle.storage_space',
						'>=',
						sql<number>`cast(${requiredCapacities.passengers} as integer) + cast(${requiredCapacities.luggage} as integer) - ${eb.ref('vehicle.seats')}`
					)
				])
			)
			.select((eb) => [
				'vehicle.id',
				'vehicle.bike_capacity',
				'vehicle.storage_space',
				'vehicle.wheelchair_capacity',
				'vehicle.seats',
				selectTours(eb, interval),
				selectAvailabilities(eb, interval)
			])
	).as('vehicles');
};

const selectCompanies = (
	eb: ExpressionBuilder<Database, 'company' | 'zone'>,
	interval: Interval,
	requiredCapacities: Capacity
) => {
	return jsonArrayFrom(
		eb
			.selectFrom('company')
			.whereRef('company.zone', '=', 'zone.id')
			.where((eb) =>
				eb.and([
					eb('company.latitude', 'is not', null),
					eb('company.longitude', 'is not', null),
					eb('company.address', 'is not', null),
					eb('company.name', 'is not', null),
					eb('company.zone', 'is not', null),
					eb('company.community_area', 'is not', null)
				])
			)
			.select([
				'company.latitude',
				'company.longitude',
				'company.id',
				'company.zone',
				selectVehicles(eb, interval, requiredCapacities)
			])
	).as('companies');
};

export const bookingApiQuery = async (
	start: Coordinates,
	requiredCapacities: Capacity,
	expandedSearchInterval: Interval,
	busStops: Coordinates[]
): Promise<BookingApiQueryResult> => {
	interface CoordinateTable {
		index: number;
		longitude: number;
		latitude: number;
	}

	const dbResult = await db
		.with('busStops', (db) => {
			const cteValues = busStops.map(
				(busStop, i) =>
					sql<string>`SELECT cast(${i} as integer) AS index, ${busStop.lat} AS latitude, ${busStop.lng} AS longitude`
			);
			return db
				.selectFrom(
					sql<CoordinateTable>`(${sql.join(cteValues, sql<string>` UNION ALL `)})`.as('cte')
				)
				.selectAll();
		})
		.selectFrom('zone')
		.where('zone.is_community', '=', false)
		.where(
			sql<boolean>`ST_Covers(zone.area, ST_SetSRID(ST_MakePoint(${start.lng}, ${start.lat}), ${SRID}))`
		)
		.select((eb) => [
			selectCompanies(eb, expandedSearchInterval, requiredCapacities),
			jsonArrayFrom(
				eb
					.selectFrom('busStops')
					.where(
						sql<boolean>`ST_Covers(zone.area, ST_SetSRID(ST_MakePoint(cast(busStops.longitude as float), cast(busStops.latitude as float)), ${SRID}))`
					)
					.select(['busStops.index as busStopIndex', 'zone.id as zoneId'])
			).as('busStopZone')
		])
		.executeTakeFirst();

	if (dbResult == undefined) {
		return { companies: [], busStopZoneIds: new Map<number, number[]>() };
	}

	const companies = dbResult.companies
		.map((c) => {
			return {
				id: c.id,
				coordinates: new Coordinates(c.latitude!, c.longitude!),
				zoneId: c.zone!,
				vehicles: c.vehicles
					.filter((v) => v.availabilities.length != 0)
					.map((v) => {
						return {
							...v,
							availabilities: Interval.merge(
								v.availabilities.map((a) => new Interval(a.start_time, a.end_time))
							),
							tours: v.tours.map((t) => {
								return {
									...t,
									events: t.events.map((e) => {
										const scheduled: Date = new Date(e.scheduled_time);
										const communicated: Date = new Date(e.communicated_time);
										return {
											tourId: t.id,
											...e,
											coordinates: new Coordinates(e.latitude, e.longitude),
											time: new Interval(
												new Date(Math.min(scheduled.getTime(), communicated.getTime())),
												new Date(Math.max(scheduled.getTime(), communicated.getTime()))
											)
										};
									})
								};
							})
						};
					})
			};
		})
		.filter((c) => c.vehicles.length != 0);
	companies.forEach((c) =>
		c.vehicles.forEach((v) => {
			v.tours.sort((t1, t2) => t1.departure.getTime() - t2.departure.getTime());
			v.tours.forEach((t) =>
				t.events.sort((e1, e2) => e1.time.startTime.getTime() - e2.time.startTime.getTime())
			);
		})
	);
	const a = groupBy(
		dbResult.busStopZone,
		(b) => b.busStopIndex,
		(b) => b.zoneId
	);
	const zoneContainsBusStop: (boolean)[][] = [];
	for(let busStopIdx=0;busStopIdx!=busStops.length;++busStopIdx){
		const buffer=new Array<boolean>(dbResult.companies.length);
		const busStopZones=a.get(busStopIdx);
		if(busStopZones!=undefined){
			for(let companyIdx=0;companyIdx!=dbResult.companies.length;++companyIdx){
				buffer[companyIdx]=busStopZones.find((z)=>z==dbResult.companies[companyIdx].zone)!=undefined;
			}
			zoneContainsBusStop[busStopIdx]=buffer;	
		}else{
		zoneContainsBusStop[busStopIdx]=[];
		}
	}
	return {
		companies,
		busStopZoneIds: groupBy(
			dbResult.busStopZone,
			(b) => b.busStopIndex,
			(b) => b.zoneId
		)
	};
};

export const areChosenCoordinatesInsideAnyZone = async (
	coordinates: Coordinates
): Promise<boolean> => {
	return (
		(await selectZonesContainingCoordinates(coordinates, undefined, ZoneType.CompulsoryArea)
			.selectAll()
			.executeTakeFirst()) != undefined
	);
};

export const doesVehicleWithCapacityExist = async (
	coordinates: Coordinates,
	requiredCapacities: Capacity
): Promise<boolean> => {
	return (
		(await joinInitializedCompaniesOnZones(
			selectZonesContainingCoordinates(coordinates, undefined, ZoneType.CompulsoryArea)
		)
			.innerJoin(
				(eb) =>
					eb
						.selectFrom('vehicle')
						.selectAll()
						.where((eb) =>
							eb.and([
								eb('vehicle.wheelchair_capacity', '>=', requiredCapacities.wheelchairs),
								eb('vehicle.bike_capacity', '>=', requiredCapacities.bikes),
								eb('vehicle.seats', '>=', requiredCapacities.passengers),
								eb('vehicle.storage_space', '>=', requiredCapacities.luggage)
							])
						)
						.as('vehicle'),
				(join) => join.onRef('vehicle.company', '=', 'company.id')
			)
			.selectAll()
			.executeTakeFirst()) == undefined
	);
};
