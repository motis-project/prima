import { db } from '$lib/database';

export async function load({ url }) {
	const tourID = url.searchParams.get('tour');

	if (tourID == null) {
		return {
			events: []
		};
	}

	const tour = db
		.selectFrom('tour')
		.where('tour.id', '=', parseInt(tourID))
		.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
		.selectAll()
		.execute();

	const events = db
		.selectFrom('tour')
		.where('tour.id', '=', parseInt(tourID))
		.innerJoin('event', 'event.tour', 'tour.id')
		.innerJoin('address', 'address.id', 'event.address')
		.innerJoin('user', 'user.id', 'event.customer')
		.orderBy('event.scheduled_time')
		.selectAll()
		.execute();

	console.log(await events);

	return {
		tour: await tour,
		events: await events
	};
}
