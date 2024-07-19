import type { PageServerLoad } from './$types.js';
import { db } from '$lib/database';
import { groupBy } from '$lib/collection_utils.js';

const company_id = 1;

export const load: PageServerLoad = async () => {
	const events = await db
		.selectFrom('event')
		.innerJoin('address', 'address.id', 'event.address')
		.innerJoin('auth_user', 'auth_user.id', 'event.customer')
		.innerJoin('tour', 'tour.id', 'event.tour')
		// .where((eb) =>
		// 	eb.and([
		// 		eb('tour.arrival', '>', earliest_displayed_time)
		// 	])
		// )
		.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
		.where('company', '=', company_id)
		.orderBy('event.scheduled_time')
		.selectAll()
		// .select(['auth_user.first_name', 'event.tour', 'tour.departure', 'tour.arrival'])
		.execute();
	console.log(events);

	const toursMap = groupBy(
		events,
		(e) => e.tour,
		(e) => e
	);
	const tours = [...toursMap].map(([tour, events]) => {
		const first = events[0]!;
		return {
			tour_id: tour,
			from: first.departure,
			to: first.arrival,
			vehicle_id: first.vehicle,
			license_plate: first.license_plate,
			events: events.map((e) => {
				return {
					address: e.address,
					latitude: e.latitude,
					longitude: e.longitude,
					street: e.street,
					postal_code: e.postal_code,
					city: e.city,
					scheduled_time: e.scheduled_time,
					house_number: e.house_number,
					first_name: e.first_name,
					last_name: e.last_name,
					phone: e.phone,
					is_pickup: e.is_pickup
				};
			})
		};
	});

	return {
		tours
	};
};
