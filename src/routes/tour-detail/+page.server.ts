import { db } from '$lib/database';

export async function load({ url }) {
	const tourID = url.searchParams.get('tour');

	if (tourID == null) {
		return {
			events: [],
		};
	}

	const events = db
		.selectFrom('tour')
		.where(
			'tour.id',
			'=',
			parseInt(tourID)
		)
		.innerJoin('event', 'event.tour', 'tour.id')
		.innerJoin('address', 'address.id', 'event.address')
		.selectAll()
		.execute();

	return {
		events: await events,
	};
}