import type { Capacities } from './capacities';
import { db } from './database';

let plate = 1;

export enum Zone {
	ALTKREIS_BAUTZEN = 1,
	WEIßWASSER = 2,
	NIESKY = 3,
	GÖRLITZ = 4,
	LÖBAU = 5,
	ZITTAU = 6
}

export const addCompany = async (zone: Zone): Promise<number> => {
	return (
		await db.insertInto('company').values({ zone: zone }).returning('id').executeTakeFirstOrThrow()
	).id;
};

export const addTaxi = async (company: number, capacities: Capacities): Promise<number> => {
	++plate;
	return (
		await db
			.insertInto('vehicle')
			.values({
				license_plate: String(plate),
				company,
				seats: capacities.passengers,
				wheelchair_capacity: capacities.wheelchairs,
				bike_capacity: capacities.bikes,
				storage_space: capacities.luggage
			})
			.returning('id')
			.executeTakeFirstOrThrow()
	).id;
};

export const setAvailability = async (vehicle: number, start_time: Date, end_time: Date) => {
	await db.insertInto('availability').values({ vehicle, start_time, end_time }).execute();
};

export const setTour = async (vehicle: number, departure: Date, arrival: Date) => {
	await db.insertInto('tour').values({ vehicle, arrival, departure }).execute();
};

export const clearDatabase = async () => {
	await db.deleteFrom('user_session').execute();
	await db.deleteFrom('availability').execute();
	await db.deleteFrom('event').execute();
	await db.deleteFrom('request').execute();
	await db.deleteFrom('tour').execute();
	await db.deleteFrom('auth_user').execute();
	await db.deleteFrom('vehicle').execute();
	await db.deleteFrom('company').execute();
};
