import { sql, type SelectQueryBuilder } from 'kysely';
import { db } from './database';
import type { Coordinates } from './location';
import type { Database } from './types';
import { SRID } from './constants';

export const queryCompletedTours = async (companyId: number | undefined) => {
	return await db
		.selectFrom('event')
		.innerJoin('tour', 'tour.id', 'event.tour')
		.where((eb) => eb.and([eb('tour.arrival', '<', new Date())]))
		.innerJoin('address', 'address.id', 'event.address')
		.innerJoin('auth_user', 'auth_user.id', 'event.customer')
		.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
		.innerJoin('company', 'company.id', 'vehicle.company')
		.$if(companyId != undefined, (qb) => qb.where('company', '=', companyId!))
		.orderBy('event.scheduled_time')
		.selectAll(['event', 'address', 'tour', 'vehicle'])
		.select([
			'company.name as company_name',
			'company.address as company_address',
			'auth_user.first_name as customer_first_name',
			'auth_user.last_name as customer_last_ame',
			'auth_user.phone as customer_phone'
		])
		.execute();
};

export enum ZoneType {
	Any,
	Community,
	CompulsoryArea
}

export const selectZonesContainingCoordinates = (
	coordinates: Coordinates,
	coordinates2: Coordinates | undefined,
	zoneType: ZoneType
) => {
	return db
		.selectFrom('zone')
		.$if(zoneType != ZoneType.Any, (qb) =>
			qb.where('zone.is_community', '=', zoneType == ZoneType.Community ? true : false)
		)
		.$if(coordinates2 != undefined, (qb) =>
			qb.where(
				sql<boolean>`ST_Covers(zone.area, ST_SetSRID(ST_MakePoint(${coordinates2!.lng}, ${coordinates2!.lat}), ${SRID}))`
			)
		)
		.where(
			sql<boolean>`ST_Covers(zone.area, ST_SetSRID(ST_MakePoint(${coordinates.lng}, ${coordinates.lat}), ${SRID}))`
		);
};

export const joinInitializedCompaniesOnZones = (
	query: SelectQueryBuilder<Database, 'zone', object>
) => {
	return query
		.innerJoin('company', 'company.zone', 'zone.id')
		.where((eb) =>
			eb.and([
				eb('company.latitude', 'is not', null),
				eb('company.longitude', 'is not', null),
				eb('company.address', 'is not', null),
				eb('company.name', 'is not', null),
				eb('company.zone', 'is not', null),
				eb('company.community_area', 'is not', null)
			])
		);
};
