import { db } from '$lib/server/db';

export async function createRideShareVehicle(
	owner: number,
	luggage: number,
	passengers: number,
	color: string | null,
	model: string | null,
	smokingAllowed: boolean,
	licensePlate: string,
	picture: string | null
) {
	return (
		await db
			.insertInto('rideShareVehicle')
			.values({
				passengers,
				luggage,
				owner,
				smokingAllowed,
				color,
				model,
				licensePlate,
				picture
			})
			.returning('id')
			.executeTakeFirstOrThrow()
	).id;
}

export async function editRideShareVehicle(
	owner: number,
	luggage: number,
	passengers: number,
	color: string | null,
	model: string | null,
	smokingAllowed: boolean,
	licensePlate: string,
	picture: string | null,
	vehicleId: number
) {
	return await db
		.updateTable('rideShareVehicle')
		.set({
			passengers,
			luggage,
			owner,
			smokingAllowed,
			color,
			model,
			licensePlate,
			picture
		})
		.where('rideShareVehicle.id', '=', vehicleId)
		.executeTakeFirstOrThrow();
}
