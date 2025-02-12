import { v4 as uuidv4 } from 'uuid';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import type { Coordinates } from '$lib/util/Coordinates';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';
import type { Capacities } from '$lib/server/booking/Capacities';
import { db } from '$lib/server/db';

export enum Zone {
	NIESKY = 1,
	WEIßWASSER = 2,
	GÖRLITZ = 3,
	LÖBAU = 4,
	ZITTAU = 5,
	ALTKREIS_BAUTZEN = 6
}

export const addCompany = async (
	zone: Zone,
	coordinates: Coordinates = { lat: 1, lng: 1 }
): Promise<number> => {
	return (
		await db
			.insertInto('company')
			.values({
				...coordinates,
				zone: zone,
				name: 'name',
				address: 'address'
			})
			.returning('id')
			.executeTakeFirstOrThrow()
	).id;
};

export const addTaxi = async (company: number, capacities: Capacities): Promise<number> => {
	return (
		await db
			.insertInto('vehicle')
			.values({
				licensePlate: uuidv4(),
				company,
				passengers: capacities.passengers,
				wheelchairs: capacities.wheelchairs,
				bikes: capacities.bikes,
				luggage: capacities.luggage
			})
			.returning('id')
			.executeTakeFirstOrThrow()
	).id;
};

export const setAvailability = async (
	vehicle: number,
	startTime: UnixtimeMs,
	endTime: UnixtimeMs
) => {
	await db.insertInto('availability').values({ vehicle, startTime, endTime }).execute();
};

export const setTour = async (vehicle: number, departure: UnixtimeMs, arrival: UnixtimeMs) => {
	return await db
		.insertInto('tour')
		.values({ vehicle, arrival, departure })
		.returning('tour.id')
		.executeTakeFirst();
};

export const setRequest = async (tour: number, customer: number, ticketCode: string) => {
	return await db
		.insertInto('request')
		.values({ passengers: 1, bikes: 0, luggage: 0, wheelchairs: 0, tour, customer, ticketCode, ticketChecked: false })
		.returning('id')
		.executeTakeFirstOrThrow();
};

export const setEvent = async (
	requestId: number,
	t: UnixtimeMs,
	isPickup: boolean,
	lat: number,
	lng: number
) => {
	await db
		.insertInto('event')
		.values({
			request: requestId,
			communicatedTime: t,
			scheduledTimeStart: t,
			scheduledTimeEnd: t,
			prevLegDuration: 0,
			nextLegDuration: 0,
			eventGroup: '',
			lat,
			lng,
			isPickup,
			address: ''
		})
		.execute();
};

export const addTestUser = async () => {
	return await db
		.insertInto('user')
		.values({
			email: 'test@user.de',
			name: '',
			isTaxiOwner: false,
			isAdmin: false,
			isEmailVerified: true,
			passwordHash:
				'$argon2id$v=19$m=19456,t=2,p=1$4lXilBjWTY+DsYpN0eATrw$imFLatxSsy9WjMny7MusOJeAJE5ZenrOEqD88YsZv8o'
		})
		.returning('id')
		.executeTakeFirstOrThrow();
};

export const clearDatabase = async () => {
	await db.deleteFrom('journey').execute();
	await db.deleteFrom('availability').execute();
	await db.deleteFrom('event').execute();
	await db.deleteFrom('request').execute();
	await db.deleteFrom('tour').execute();
	await db.deleteFrom('vehicle').execute();
	await db.deleteFrom('session').execute();
	await db.deleteFrom('user').execute();
	await db.deleteFrom('company').execute();
};

export const clearTours = async () => {
	await db.deleteFrom('event').execute();
	await db.deleteFrom('request').execute();
	await db.deleteFrom('tour').execute();
};

export const getTours = async () => {
	return await db
		.selectFrom('tour')
		.selectAll()
		.select((eb) => [
			jsonArrayFrom(
				eb
					.selectFrom('request')
					.whereRef('request.tour', '=', 'tour.id')
					.selectAll()
					.select((eb) => [
						jsonArrayFrom(
							eb.selectFrom('event').whereRef('event.request', '=', 'request.id').selectAll()
						).as('events')
					])
			).as('requests')
		])
		.execute();
};
