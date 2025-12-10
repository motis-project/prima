import type { RequestEvent } from './$types';
import { error } from '@sveltejs/kit';
import type { Coordinates } from '$lib/util/Coordinates';
import { db } from '$lib/server/db';
import { selectDesiredTrips } from '$lib/server/booking/rideShare/selectDesiredTrips';

export const POST = async (event: RequestEvent) => {
	const userId = event.locals.session?.userId;
	if (userId === undefined) {
		throw error(403, 'forbidden');
	}
	const {
		from,
		to,
		time,
		startFixed,
		luggage,
		passengers,
		alertId
	}: {
		from: Coordinates;
		to: Coordinates;
		time: number;
		startFixed: boolean;
		luggage: number;
		passengers: number;
		alertId?: number;
	} = await event.request.json();
	if (alertId === undefined) {
		await db
			.insertInto('desiredRideShare')
			.values({
				interestedUser: userId,
				fromLat: from.lat,
				fromLng: from.lng,
				toLat: to.lat,
				toLng: to.lng,
				startFixed,
				fromAddress: '',
				toAddress: '',
				time,
				luggage,
				passengers
			})
			.execute();
	} else {
		await db
			.deleteFrom('desiredRideShare')
			.where('desiredRideShare.id', '=', alertId)
			.where('desiredRideShare.interestedUser', '=', userId)
			.execute();
	}
	return selectDesiredTrips(userId);
};
