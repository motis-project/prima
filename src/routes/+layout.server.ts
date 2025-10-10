import { db } from '$lib/server/db';
import type { LayoutServerLoad } from './$types';

export const load = async ({ locals, url }: Parameters<LayoutServerLoad>[0]) => {
	const displayFeedbackBanner =
		locals.session &&
		!url.pathname.startsWith('/rating') &&
		!url.pathname.startsWith('/ride-share-rating');
	const pendingRating = displayFeedbackBanner
		? await getLatestPendingRating('tour', locals.session!.userId)
		: undefined;

	const pendingRideShareRating = displayFeedbackBanner
		? await getLatestPendingRating('rideShareTour', locals.session!.userId)
		: undefined;
	const taxiTime = pendingRating?.time ?? 0;
	const rideShareTime = pendingRideShareRating?.time ?? 0;
	const taxiWasLast = pendingRating && (!pendingRideShareRating || taxiTime > rideShareTime);
	return {
		pendingRating: taxiWasLast && pendingRating?.journeyId,
		pendingRideShareRating:
			!taxiWasLast && (pendingRideShareRating?.requestId ?? pendingRideShareRating?.requestId),
		isLoggedIn: !!locals.session,
		isAdmin: locals.session?.isAdmin,
		isTaxiOwner: locals.session?.isTaxiOwner
	};
};

async function getLatestPendingRating(column: 'tour' | 'rideShareTour', userId: number) {
	return await db
		.selectFrom('request')
		.innerJoin('journey', (join) =>
			join.on((eb) =>
				eb.or([
					eb('journey.request1', '=', eb.ref('request.id')),
					eb('journey.request2', '=', eb.ref('request.id'))
				])
			)
		)
		.leftJoin('rideShareTour', 'rideShareTour.id', 'request.rideShareTour')
		.leftJoin('rideShareVehicle', 'rideShareVehicle.id', 'rideShareTour.vehicle')
		.leftJoin('rideShareRating', (join) =>
			join.on((eb) =>
				eb.and([
					eb('rideShareRating.request', '=', eb.ref('request.id')),
					eb.or([
						eb('rideShareRating.ratedIsCustomer', '=', true),
						eb('rideShareVehicle.owner', '=', userId)
					]),
					eb.or([
						eb('rideShareRating.ratedIsCustomer', '=', false),
						eb('request.customer', '=', userId)
					])
				])
			)
		)
		.innerJoin(
			(qb) =>
				qb
					.selectFrom('event')
					.select(['event.request', 'event.communicatedTime as time'])
					.distinctOn('event.request')
					.orderBy('event.request')
					.orderBy('event.communicatedTime', 'desc')
					.as('lastEvent'),
			(join) => join.onRef('lastEvent.request', '=', 'request.id')
		)
		.where((eb) =>
			eb.not(
				eb.exists(
					eb
						.selectFrom('event')
						.select('id')
						.whereRef('event.request', '=', 'request.id')
						.where('event.communicatedTime', '>=', Date.now())
				)
			)
		)
		.$if(column === 'tour', (qb) =>
			qb
				.where('request.tour', 'is not', null)
				.where('journey.rating', 'is', null)
				.where('journey.user', '=', userId)
		)
		.$if(column === 'rideShareTour', (qb) =>
			qb
				.where('request.rideShareTour', 'is not', null)
				.where('rideShareRating.id', 'is', null)
				.where('request.pending', '=', false)
				.whereRef('request.customer', '!=', 'rideShareVehicle.owner')
				.where((eb) =>
					eb.or([eb('rideShareVehicle.owner', '=', userId), eb('journey.user', '=', userId)])
				)
		)
		.select(['journey.id as journeyId', 'request.id as requestId', 'lastEvent.time'])
		.orderBy('lastEvent.time')
		.executeTakeFirst();
}
