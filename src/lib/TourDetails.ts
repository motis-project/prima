import { groupBy } from '$lib/collection_utils.js';
import type { Database } from '$lib/types';
import {
	DummyDriver,
	Kysely,
	PostgresAdapter,
	PostgresIntrospector,
	PostgresQueryCompiler
} from 'kysely';

const db = new Kysely<Database>({
	dialect: {
		createAdapter: () => new PostgresAdapter(),
		createDriver: () => new DummyDriver(),
		createIntrospector: (db) => new PostgresIntrospector(db),
		createQueryCompiler: () => new PostgresQueryCompiler()
	}
});

export const getTourEvents = () => {
	return db
		.selectFrom('event')
		.innerJoin('address', 'address.id', 'event.address')
		.innerJoin('auth_user', 'auth_user.id', 'event.customer')
		.innerJoin('tour', 'tour.id', 'event.tour')
		.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
		.innerJoin('company', 'company.id', 'vehicle.company')
		.selectAll(['event', 'address', 'tour', 'vehicle'])
		.select([
			'company.name as company_name',
			'company.address as company_address',
			'auth_user.first_name as customer_first_name',
			'auth_user.last_name as customer_last_ame',
			'auth_user.phone as customer_phone'
		])
		.execute();
};

type DbTourEvents = Awaited<ReturnType<typeof getTourEvents>>;

export const mapTourEvents = (events: DbTourEvents) => {
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
			company_id: first.company,
			company_name: first.company_name,
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
					first_name: e.customer_first_name,
					last_name: e.customer_last_ame,
					phone: e.customer_phone,
					is_pickup: e.is_pickup,
					customer_id: e.customer
				};
			})
		};
	});
	return tours;
};

type TourEvents = ReturnType<typeof mapTourEvents>;
export type TourDetails = TourEvents[0];
export type Event = TourDetails['events'][0];

export const getTourInfoShort = (tour: TourDetails) => {
	const l1 = tour.events[0];
	const l2 = tour.events[tour.events.length - 1];

	if (l1.city === '' || l2.city === '') {
		return [l1.street, l2.street];
	}
	return [l1.city + ': ' + l1.street, l2.city + ': ' + l2.street];
};
