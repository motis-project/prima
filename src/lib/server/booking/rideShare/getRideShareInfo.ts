import type { Itinerary } from '$lib/openapi';
import { db } from '$lib/server/db';
import { isRideShareLeg } from '$lib/util/booking/checkLegType';

export async function getRideShareInfo(tourId: number, extended: boolean) {
	const result = await db
		.selectFrom('rideShareTour')
		.innerJoin('rideShareVehicle', 'rideShareTour.vehicle', 'rideShareVehicle.id')
		.leftJoin('request as rideShareRequest', 'rideShareRequest.rideShareTour', 'rideShareTour.id')
		.innerJoin('user', 'user.id', 'rideShareVehicle.owner')
		.select((eb) => [
			'rideShareTour.id as tourId',
			'rideShareVehicle.model',
			'rideShareVehicle.smokingAllowed',
			'user.firstName',
			'user.name',
			'user.gender',
			'user.profilePicture',
			'rideShareVehicle.licensePlate',
			'rideShareVehicle.color',
			'rideShareVehicle.picture',
			eb
				.selectFrom('rideShareRating')
				.innerJoin('request', 'rideShareRating.request', 'request.id')
				.whereRef('request.customer', '=', 'user.id')
				.where('rideShareRating.ratedIsCustomer', '=', true)
				.where('rideShareRequest.pending', '=', false)
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
	if (!extended && result) {
		result.licensePlate = '';
		result.color = null;
		result.picture = null;
	}
	return result;
}

export async function getRideShareInfos(i: Itinerary, extended = false) {
	const rideShareTourInfos: RideShareTourInfo[] = [];

	if (i.legs.length !== 0) {
		const rideShareTourFirstLeg = isRideShareLeg(i.legs[0])
			? JSON.parse(i.legs[0].tripId!)?.tour
			: undefined;
		const rideShareTourLastLeg =
			i.legs.length > 1 && isRideShareLeg(i.legs[i.legs.length - 1])
				? JSON.parse(i.legs[i.legs.length - 1].tripId!)?.tour
				: undefined;
		if (rideShareTourFirstLeg !== undefined && !isNaN(rideShareTourFirstLeg)) {
			rideShareTourInfos.push(await getRideShareInfo(rideShareTourFirstLeg, extended));
		}
		if (rideShareTourLastLeg !== undefined && !isNaN(rideShareTourLastLeg)) {
			rideShareTourInfos.push(await getRideShareInfo(rideShareTourLastLeg, extended));
		}
	}
	return rideShareTourInfos;
}

export type RideShareTourInfo = Awaited<ReturnType<typeof getRideShareInfo>>;
