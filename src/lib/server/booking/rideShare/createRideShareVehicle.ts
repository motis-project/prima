import { db } from '$lib/server/db';

export async function createRideShareVehicle(
	owner: number,
	luggage: number,
	passengers: number,
	color: string,
	model: string,
	smokingAllowed: boolean,
	licensePlate: string
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
				licensePlate
			})
			.returning('id')
			.executeTakeFirstOrThrow()
	).id;
}
