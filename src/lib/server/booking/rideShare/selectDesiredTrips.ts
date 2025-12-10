import { db } from '$lib/server/db';

export async function selectDesiredTrips(userId: number) {
	return await db
		.selectFrom('desiredRideShare')
		.where('desiredRideShare.interestedUser', '=', userId)
		.selectAll()
		.execute();
}
