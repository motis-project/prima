import type { Location } from '$lib/location';
import type { Database } from '$lib/types';
import { Transaction } from 'kysely';

export const getBookingIssues = async (
	from: Location,
	to: Location,
	startTime: Date,
	targetTime: Date,
	numPassengers: number,
	numWheelchairs: number,
	numBikes: number,
	luggage: number,
	customerId: string,
	bestCompany: { departure: Date; arrival: Date; vehicleId: number }
): Promise<Response | undefined> => {
	return undefined;
};

export const bookingQuery = async (
	trx: Transaction<Database>,
	from: Location,
	to: Location,
	startTime: Date,
	targetTime: Date,
	numPassengers: number,
	numWheelchairs: number,
	numBikes: number,
	luggage: number,
	customerId: string,
	bestCompany: { departure: Date; arrival: Date; vehicleId: number }
) => {
	trx
		.with('startAddress', (db) =>
			db
				.insertInto('address')
				.values({
					street: from.address.street,
					house_number: from.address.house_number,
					postal_code: from.address.postal_code,
					city: from.address.city
				})
				.onConflict((oc) => oc.constraint('unique_addres').doUpdateSet({}))
				.returning('id')
		)
		.with('targetAddress', (db) =>
			db
				.insertInto('address')
				.values({
					street: to.address.street,
					house_number: to.address.house_number,
					postal_code: to.address.postal_code,
					city: to.address.city
				})
				.onConflict((oc) => oc.constraint('unique_addres').doUpdateSet({}))
				.returning('id')
		)
		.with('insertedTour', (db) => {
			return db
				.insertInto('tour')
				.values({
					departure: bestCompany.departure,
					arrival: bestCompany.arrival,
					vehicle: bestCompany.vehicleId!
				})
				.returning('id');
		})
		.with('insertedRequest', (db) => {
			return db
				.insertInto('request')
				.values((eb) => ({
					tour: eb.selectFrom('insertedTour').select(['insertedTour.id']),
					passengers: numPassengers,
					bikes: numBikes,
					wheelchairs: numWheelchairs,
					luggage
				}))
				.returning('id');
		})
		.insertInto('event')
		.values((eb) => [
			{
				is_pickup: true,
				latitude: from.coordinates.lat,
				longitude: from.coordinates.lng,
				scheduled_time: startTime,
				communicated_time: startTime, // TODO
				address: eb.selectFrom('startAddress').select(['startAddress.id']),
				request: eb.selectFrom('insertedRequest').select(['insertedRequest.id'])!,
				tour: eb.selectFrom('insertedTour').select(['insertedTour.id'])!,
				customer: customerId,
				passengers: numPassengers,
				bikes: numBikes,
				wheelchairs: numWheelchairs,
				luggage
			},
			{
				is_pickup: false,
				latitude: to.coordinates.lat,
				longitude: to.coordinates.lng,
				scheduled_time: targetTime,
				communicated_time: targetTime, // TODO
				address: eb.selectFrom('targetAddress').select(['targetAddress.id']),
				request: eb.selectFrom('insertedRequest').select(['insertedRequest.id'])!,
				tour: eb.selectFrom('insertedTour').select(['insertedTour.id'])!,
				customer: customerId,
				passengers: numPassengers,
				bikes: numBikes,
				wheelchairs: numWheelchairs,
				luggage
			}
		])
		.execute();
};
