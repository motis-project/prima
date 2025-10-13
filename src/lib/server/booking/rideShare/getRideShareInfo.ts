import type { Itinerary } from '$lib/openapi';
import { db } from '$lib/server/db';
import { isRideShareLeg } from '../../../../routes/(customer)/routing/utils';

export async function getRideShareInfo(tourId: number) {
	return await db
		.selectFrom('rideShareTour')
		.innerJoin('rideShareVehicle', 'rideShareTour.vehicle', 'rideShareVehicle.id')
		.leftJoin('request as rideShareRequest', 'rideShareRequest.rideShareTour', 'rideShareTour.id')
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
				.where('rideShareRequest.pending', '=', false)
				.where('rideShareRequest.startFixed', 'is not', null)
				.select(db.fn.avg('rideShareRating.rating').as('averageRating'))
				.as('averageRatingCustomer'),
			eb
				.selectFrom('rideShareRating')
				.innerJoin('request', 'rideShareRating.request', 'request.id')
				.innerJoin('rideShareTour', 'rideShareTour.id', 'request.rideShareTour')
				.innerJoin('rideShareVehicle', 'rideShareVehicle.id', 'rideShareTour.vehicle')
				.whereRef('rideShareVehicle.owner', '=', 'user.id')
				.where('rideShareRating.ratedIsCustomer', '=', false)
				.where('rideShareRequest.pending', '=', false)
				.select(db.fn.avg('rideShareRating.rating').as('averageRating'))
				.as('averageRatingProvider')
		])
		.where('rideShareTour.id', '=', tourId)
		.executeTakeFirst();
}

export async function getRideShareInfos(i: Itinerary) {
	const rideShareTourInfos: RideShareTourInfo[] = [];

	if (i.legs.length !== 0) {
		const rideShareTourFirstLeg = isRideShareLeg(i.legs[0])
			? parseInt(i.legs[0].tripId!)
			: undefined;
		const rideShareTourLastLeg =
			i.legs.length > 1 && isRideShareLeg(i.legs[i.legs.length - 1])
				? parseInt(i.legs[i.legs.length - 1].tripId!)
				: undefined;
		if (rideShareTourFirstLeg !== undefined && !isNaN(rideShareTourFirstLeg)) {
			rideShareTourInfos.push(await getRideShareInfo(rideShareTourFirstLeg));
		}
		if (rideShareTourLastLeg !== undefined && !isNaN(rideShareTourLastLeg)) {
			rideShareTourInfos.push(await getRideShareInfo(rideShareTourLastLeg));
		}
	}
	return rideShareTourInfos;
}

export type RideShareTourInfo = Awaited<ReturnType<typeof getRideShareInfo>>;
