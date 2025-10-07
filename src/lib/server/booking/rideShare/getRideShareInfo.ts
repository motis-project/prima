import { db } from '$lib/server/db';

export async function getRideShareInfo(tourId: number) {
	return await db
		.selectFrom('rideShareTour')
		.innerJoin('rideShareVehicle', 'rideShareTour.vehicle', 'rideShareVehicle.id')
		.innerJoin('user', 'user.id', 'rideShareVehicle.owner')
		.select([
			'rideShareVehicle.color',
			'rideShareVehicle.licensePlate',
			'rideShareVehicle.model',
			'rideShareVehicle.smokingAllowed',
			'user.firstName',
			'user.name',
			'user.gender',
			'user.profilePicture',
			'rideShareVehicle.picture'
		])
		.where('rideShareTour.id', '=', tourId)
		.executeTakeFirst();
}

export type RideShareTourInfo = Awaited<ReturnType<typeof getRideShareInfo>>;
