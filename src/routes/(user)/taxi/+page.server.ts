import { groupBy } from '$lib/collection_utils.js';
import { TZ } from '$lib/constants.js';
import { db } from '$lib/database';

export async function load({ url }) {
	const company_id = 1;
	const localDateParam = url.searchParams.get('date');
	const localDate = localDateParam ? new Date(localDateParam) : new Date();
	const utcDate = new Date(localDate.toLocaleString('en', { timeZone: TZ }));
	utcDate.setHours(0, 0, 0, 0);
	const earliest_displayed_time = new Date(utcDate);
	earliest_displayed_time.setHours(utcDate.getHours() - 1);
	const latest_displayed_time = new Date(utcDate);
	latest_displayed_time.setHours(utcDate.getHours() + 25);

	const vehicles = db.selectFrom('vehicle').where('company', '=', company_id).selectAll().execute();

	const availabilities = db
		.selectFrom('vehicle')
		.where('company', '=', company_id)
		.innerJoin('availability', 'vehicle', 'vehicle.id')
		.where((eb) =>
			eb.and([
				eb('availability.start_time', '<', latest_displayed_time),
				eb('availability.end_time', '>', earliest_displayed_time)
			])
		)
		.select([
			'availability.id',
			'availability.start_time',
			'availability.end_time',
			'availability.vehicle'
		])
		.execute();

	const events = await db
		.selectFrom('event')
		.innerJoin('address', 'address.id', 'event.address')
		.innerJoin('auth_user', 'auth_user.id', 'event.customer')
		.innerJoin('tour', 'tour.id', 'event.tour')
		.where((eb) =>
			eb.and([
				eb('tour.departure', '<', latest_displayed_time),
				eb('tour.arrival', '>', earliest_displayed_time)
			])
		)
		.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
		.where('company', '=', company_id)
		.orderBy('event.scheduled_time')
		.selectAll()
		.execute();

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
		tours,
		vehicles: await vehicles,
		availabilities: await availabilities,
		utcDate
	};
}
