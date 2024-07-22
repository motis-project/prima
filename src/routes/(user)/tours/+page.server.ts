import type { PageServerLoad } from './$types.js';
import { db } from '$lib/database';
import { TZ } from '$lib/constants.js';
import { mapTourEvents } from '$lib/utils.js';

const company_id = 1;

export const load: PageServerLoad = async () => {
	const utcDate = new Date(new Date().toLocaleString('en', { timeZone: TZ }));

	const tours = mapTourEvents(
		await db
			.selectFrom('event')
			.innerJoin('address', 'address.id', 'event.address')
			.innerJoin('auth_user', 'auth_user.id', 'event.customer')
			.innerJoin('tour', 'tour.id', 'event.tour')
			.where((eb) => eb.and([eb('tour.arrival', '<', utcDate)]))
			.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
			.where('company', '=', company_id)
			.orderBy('event.scheduled_time')
			.selectAll()
			.execute()
	);

	return {
		tours
	};
};
