import { db } from '$lib/server/db';

export async function getRideShareInfo(tourId: number) {
	return await db
		.selectFrom('rideShareTour')
		.innerJoin('rideShareVehicle', 'rideShareTour.vehicle', 'rideShareVehicle.id')
		.innerJoin('request as rideShareRequest', 'rideShareRequest.rideShareTour', 'rideShareTour.id')
		.innerJoin('user', 'user.id', 'rideShareVehicle.owner')
		.select((eb) => [
			'rideShareVehicle.color',
			'rideShareVehicle.licensePlate',
			'rideShareVehicle.model',
			'rideShareVehicle.smokingAllowed',
			'user.firstName',
			'user.name',
			'user.gender',
			'user.profilePicture',
			'rideShareVehicle.picture',
			'rideShareTour.id as tourId',
			eb
				.selectFrom('rideShareRating')
				.innerJoin('request', 'rideShareRating.request', 'request.id')
				.whereRef('request.customer', '=', 'user.id')
				.where('rideShareRating.ratedIsCustomer', '=', true)
				.select(db.fn.avg('rideShareRating.rating').as('averageRating'))
				.as('averageRatingCustomer'),
			eb
				.selectFrom('rideShareRating')
				.innerJoin('request', 'rideShareRating.request', 'request.id')
				.innerJoin('rideShareTour', 'rideShareRating.request', 'request.rideShareTour')
				.innerJoin('rideShareVehicle', 'rideShareVehicle.id', 'rideShareTour.vehicle')
				.whereRef('rideShareVehicle.owner', '=', 'user.id')
				.where('rideShareRating.ratedIsCustomer', '=', false)
				.select(db.fn.avg('rideShareRating.rating').as('averageRating'))
				.as('averageRatingProvider')
		])
		.where('rideShareTour.id', '=', tourId)
		.where('rideShareRequest.pending', '=', false)
		.where('rideShareRequest.startFixed', 'is not', null)
		.executeTakeFirst();
}

export type RideShareTourInfo = Awaited<ReturnType<typeof getRideShareInfo>>;
