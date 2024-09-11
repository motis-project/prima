// import { computeSearchIntervals } from './searchInterval';
import { db } from '$lib/database';
import { describe, it, expect, beforeAll } from 'vitest';

let plate = 1;

const addCompany = async (): Promise<number> => {
	return (await db
		.insertInto('company')
		.values({ address: null })
		.returning('id')
		.executeTakeFirst())!.id;
};

const addTaxi = async (company: number): Promise<number> => {
	++plate;
	return (await db
		.insertInto('vehicle')
		.values({
			license_plate: String(plate),
			company,
			seats: 3,
			wheelchair_capacity: 0,
			bike_capacity: 0,
			storage_space: 0
		})
		.returning('id')
		.executeTakeFirst())!.id;
};

const clearDatabase = async () => {
	await Promise.all([
		db.deleteFrom('company').execute(),
		db.deleteFrom('vehicle').execute(),
		db.deleteFrom('tour').execute(),
		db.deleteFrom('availability').execute(),
		db.deleteFrom('auth_user').execute(),
		db.deleteFrom('user_session').execute(),
		db.deleteFrom('event').execute(),
		db.deleteFrom('address').execute(),
		db.deleteFrom('request').execute()
	]);
};

describe('sum test', () => {
	beforeAll(async () => {
		await clearDatabase();
	});

	it('adds 1 + 2 to equal 3', async () => {
		const company = await addCompany();
		const taxi1 = await addTaxi(company);
		const taxi2 = await addTaxi(company);

		console.log(taxi1, taxi2);

		// await setAvailability(taxi1, ['2024-09-23T17:00', '2024-09-23T18:00']);
		// await setAvailability(taxi2, ['2024-09-23T17:30', '2024-09-23T18:30']);

		// await addBooking();
	});
});
