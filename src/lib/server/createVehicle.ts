import { db } from '$lib/server/db';

export type NewVehicle = {
	licensePlate: string;
	company: number;
	passengers: number;
	luggage: number;
	wheelchairs: number;
	bikes: number;
};

export async function createVehicle(vehicle: NewVehicle): Promise<number> {
	return (
		await db
			.insertInto('vehicle')
			.values((eb) => ({
				...vehicle,
				setAutomaticAvailability: eb
					.case()
					.when(
						eb.exists(
							eb
								.selectFrom('vehicle')
								.select('vehicle.id')
								.where('vehicle.company', '=', vehicle.company)
						)
					)
					.then(false)
					.else(true)
					.end()
			}))
			.returning('vehicle.id')
			.executeTakeFirstOrThrow()
	).id;
}
