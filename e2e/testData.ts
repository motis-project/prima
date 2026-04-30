import { sql } from 'kysely';
import { execSQL } from './utils';

type SeedUserOptions = {
	email: string;
	passwordHash: string;
	name?: string;
	companyId?: number | null;
	isTaxiOwner?: boolean;
	upsert?: boolean;
};

type SeedCompanyOptions = {
	lat: number | null;
	lng: number | null;
	name: string | null;
	address: string | null;
	zoneName: string | null;
	phone: string | null;
};

type SeedVehicleOptions = {
	licensePlate: string;
	companyId: number;
	passengers?: number;
	wheelchairs?: number;
	bikes?: number;
	luggage?: number;
};

type SeedAvailabilityOptions = {
	startTime: number;
	endTime: number;
	vehicleId: number;
};

type SeedTourWithEventsOptions = {
	vehicleId: number;
	customerId: number;
	pickupTime: number;
	dropoffTime: number;
};

export async function clearE2EData() {
	await execSQL(sql`
		DELETE FROM journey;
		DELETE FROM availability;
		DELETE FROM event;
		DELETE FROM event_group;
		DELETE FROM ride_share_rating;
		DELETE FROM request;
		DELETE FROM tour;
		DELETE FROM ride_share_tour;
		DELETE FROM ride_share_vehicle;
		DELETE FROM vehicle;
		DELETE FROM session;
		DELETE FROM desired_ride_share;
		DELETE FROM "user";
		DELETE FROM company;
	`);
}

export async function clearSessionsForUser(email: string) {
	await execSQL(sql`
		DELETE FROM "session"
		WHERE user_id IN (SELECT id FROM "user" WHERE email = ${email})
	`);
}

export async function seedCompany(options: SeedCompanyOptions) {
	const company = await execSQL<{ id: number }>(sql`
		INSERT INTO company (lat, lng, name, address, zone, phone)
		VALUES (
			${options.lat},
			${options.lng},
			${options.name},
			${options.address},
			(SELECT id FROM zone WHERE name = ${options.zoneName} ORDER BY id DESC LIMIT 1),
			${options.phone}
		)
		RETURNING id
	`);
	return company.rows[0].id;
}

export async function seedWeisswasserCompany() {
	return seedCompany({
		lat: 51.493713,
		lng: 14.6258545,
		name: 'Taxi Weißwasser',
		address:
			'Werner-Seelenbinder-Straße 70a, Weißwasser/Oberlausitz, Weißwasser/Oberlausitz, Sachsen',
		zoneName: 'Weißwasser',
		phone: '555666'
	});
}

export async function seedUser(options: SeedUserOptions) {
	const companyId = options.companyId ?? null;
	const isTaxiOwner = options.isTaxiOwner ?? false;
	const name = options.name ?? options.email;

	if (options.upsert) {
		const user = await execSQL<{ id: number }>(sql`
			INSERT INTO "user" (
				email,
				name,
				first_name,
				gender,
				zip_code,
				city,
				region,
				password_hash,
				is_email_verified,
				email_verification_code,
				email_verification_expires_at,
				password_reset_code,
				password_reset_expires_at,
				is_taxi_owner,
				is_admin,
				is_service,
				phone,
				company_id
			)
			VALUES (
				${options.email},
				${name},
				'Vorname',
				'o',
				'ZIP',
				'City',
				'',
				${options.passwordHash},
				TRUE,
				NULL,
				NULL,
				NULL,
				NULL,
				${isTaxiOwner},
				FALSE,
				FALSE,
				NULL,
				${companyId}
			)
			ON CONFLICT (email) DO UPDATE SET
				name = EXCLUDED.name,
				first_name = EXCLUDED.first_name,
				gender = EXCLUDED.gender,
				zip_code = EXCLUDED.zip_code,
				city = EXCLUDED.city,
				region = EXCLUDED.region,
				password_hash = EXCLUDED.password_hash,
				is_email_verified = EXCLUDED.is_email_verified,
				email_verification_code = EXCLUDED.email_verification_code,
				email_verification_expires_at = EXCLUDED.email_verification_expires_at,
				password_reset_code = EXCLUDED.password_reset_code,
				password_reset_expires_at = EXCLUDED.password_reset_expires_at,
				is_taxi_owner = EXCLUDED.is_taxi_owner,
				is_admin = EXCLUDED.is_admin,
				is_service = EXCLUDED.is_service,
				phone = EXCLUDED.phone,
				company_id = EXCLUDED.company_id
			RETURNING id
		`);
		return user.rows[0].id;
	}

	const user = await execSQL<{ id: number }>(sql`
		INSERT INTO "user" (
			email,
			name,
			first_name,
			gender,
			zip_code,
			city,
			region,
			password_hash,
			is_email_verified,
			email_verification_code,
			email_verification_expires_at,
			password_reset_code,
			password_reset_expires_at,
			is_taxi_owner,
			is_admin,
			is_service,
			phone,
			company_id
		)
		VALUES (
			${options.email},
			${name},
			'Vorname',
			'o',
			'ZIP',
			'City',
			'',
			${options.passwordHash},
			TRUE,
			NULL,
			NULL,
			NULL,
			NULL,
			${isTaxiOwner},
			FALSE,
			FALSE,
			NULL,
			${companyId}
		)
		RETURNING id
	`);
	return user.rows[0].id;
}

export async function seedVehicle(options: SeedVehicleOptions) {
	const vehicle = await execSQL<{ id: number }>(sql`
		INSERT INTO vehicle (license_plate, company, passengers, wheelchairs, bikes, luggage)
		VALUES (
			${options.licensePlate},
			${options.companyId},
			${options.passengers ?? 4},
			${options.wheelchairs ?? 0},
			${options.bikes ?? 0},
			${options.luggage ?? 4}
		)
		RETURNING id
	`);
	return vehicle.rows[0].id;
}

export async function seedAvailability(options: SeedAvailabilityOptions) {
	await execSQL(sql`
		INSERT INTO availability (start_time, end_time, vehicle)
		VALUES (${options.startTime}, ${options.endTime}, ${options.vehicleId})
	`);
}

export async function seedTourWithEvents(options: SeedTourWithEventsOptions) {
	const tour = await execSQL<{ id: number }>(sql`
		INSERT INTO tour (departure, arrival, vehicle, fare, direct_duration, cancelled, message)
		VALUES (
			${options.pickupTime},
			${options.dropoffTime},
			${options.vehicleId},
			NULL,
			${options.dropoffTime - options.pickupTime},
			FALSE,
			NULL
		)
		RETURNING id
	`);
	const tourId = tour.rows[0].id;

	const request = await execSQL<{ id: number }>(sql`
		INSERT INTO request (
			passengers,
			kids_zero_to_two,
			kids_three_to_four,
			kids_five_to_six,
			wheelchairs,
			bikes,
			luggage,
			tour,
			ride_share_tour,
			customer,
			ticket_code,
			ticket_checked,
			ticket_price,
			cancelled,
			license_plate_updated_at,
			pending,
			start_fixed,
			bus_stop_time,
			requested_time,
			cancelled_by_customer
		)
		VALUES (
			1,
			0,
			0,
			0,
			0,
			0,
			0,
			${tourId},
			NULL,
			${options.customerId},
			'seed-ticket-code',
			FALSE,
			300,
			FALSE,
			NULL,
			FALSE,
			FALSE,
			NULL,
			${options.pickupTime},
			FALSE
		)
		RETURNING id
	`);
	const requestId = request.rows[0].id;

	const pickup = await seedEventGroup(options.pickupTime, 51.493713, 14.6258545, 'pickup address');
	const dropoff = await seedEventGroup(
		options.dropoffTime,
		51.50577743128434,
		14.637890411515059,
		'dropoff address'
	);

	await execSQL(sql`
		INSERT INTO event (is_pickup, event_group_id, request, cancelled, communicated_time)
		VALUES
			(TRUE, ${pickup}, ${requestId}, FALSE, ${options.pickupTime}),
			(FALSE, ${dropoff}, ${requestId}, FALSE, ${options.dropoffTime})
	`);
}

async function seedEventGroup(time: number, lat: number, lng: number, address: string) {
	const eventGroup = await execSQL<{ id: number }>(sql`
		INSERT INTO event_group (
			lat,
			lng,
			scheduled_time_start,
			scheduled_time_end,
			prev_leg_duration,
			next_leg_duration,
			address
		)
		VALUES (${lat}, ${lng}, ${time}, ${time}, 0, 0, ${address})
		RETURNING id
	`);
	return eventGroup.rows[0].id;
}
