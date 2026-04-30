import { test, expect, type Page } from '@playwright/test';
import { sql } from 'kysely';
import { hashPassword } from '../src/lib/server/auth/password';
import { DAY, HOUR, MINUTE, SECOND } from '../src/lib/util/time';
import { login, in6Days, execSQL, TAXI_OWNER, offset, dayString, logout } from './utils';

const fromTime = in6Days.getTime();
const toTime = in6Days.getTime() + DAY - SECOND;
const taxiOwnerEmail = TAXI_OWNER.email;
const customerEmail = 'driver-test-customer@test.de';

test.beforeAll(async () => {
	const taxiOwnerPasswordHash = await hashPassword(TAXI_OWNER.password);
	const customerPasswordHash = await hashPassword('longEnough2');

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

	const company = await execSQL<{ id: number }>(sql`
		INSERT INTO company (lat, lng, name, address, zone, phone)
		VALUES (
			51.493713,
			14.6258545,
			'Taxi Weißwasser',
			'Werner-Seelenbinder-Straße 70a, Weißwasser/Oberlausitz, Weißwasser/Oberlausitz, Sachsen',
			(SELECT id FROM zone WHERE name = 'Weißwasser' ORDER BY id DESC LIMIT 1),
			'555666'
		)
		RETURNING id
	`);
	const companyId = company.rows[0].id;

	await execSQL(sql`
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
		VALUES
		(
			${taxiOwnerEmail},
			${taxiOwnerEmail},
			'Vorname',
			'o',
			'ZIP',
			'City',
			'',
			${taxiOwnerPasswordHash},
			TRUE,
			NULL,
			NULL,
			NULL,
			NULL,
			TRUE,
			FALSE,
			FALSE,
			NULL,
			${companyId}
		),
		(
			${customerEmail},
			'driver test customer',
			'Vorname',
			'o',
			'ZIP',
			'City',
			'',
			${customerPasswordHash},
			TRUE,
			NULL,
			NULL,
			NULL,
			NULL,
			FALSE,
			FALSE,
			FALSE,
			NULL,
			NULL
		)
	`);

	const vehicles = await execSQL<{ id: number; license_plate: string }>(sql`
		INSERT INTO vehicle (license_plate, company, passengers, wheelchairs, bikes, luggage)
		VALUES
			('GR-TU-11', ${companyId}, 4, 0, 0, 4),
			('GR-TU-12', ${companyId}, 4, 0, 0, 4)
		RETURNING id, license_plate
	`);
	const vehicle1 = vehicles.rows.find((vehicle) => vehicle.license_plate === 'GR-TU-11')!.id;

	const availabilityStart = in6Days.getTime() + HOUR * 7;
	await execSQL(sql`
		INSERT INTO availability (start_time, end_time, vehicle)
		VALUES (${availabilityStart}, ${availabilityStart + HOUR * 3}, ${vehicle1})
	`);

	const customer = await execSQL<{ id: number }>(sql`
		SELECT id FROM "user" WHERE email = ${customerEmail}
	`);
	const customerId = customer.rows[0].id;

	await seedTour(
		vehicle1,
		customerId,
		availabilityStart + HOUR,
		availabilityStart + HOUR + MINUTE * 30
	);
	await seedTour(
		vehicle1,
		customerId,
		availabilityStart + HOUR * 2,
		availabilityStart + HOUR * 2 + MINUTE * 30
	);
});

async function seedTour(
	vehicleId: number,
	customerId: number,
	pickupTime: number,
	dropoffTime: number
) {
	const tour = await execSQL<{ id: number }>(sql`
		INSERT INTO tour (departure, arrival, vehicle, fare, direct_duration, cancelled, message)
		VALUES (${pickupTime}, ${dropoffTime}, ${vehicleId}, NULL, ${dropoffTime - pickupTime}, FALSE, NULL)
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
			${customerId},
			'seed-ticket-code',
			FALSE,
			300,
			FALSE,
			NULL,
			FALSE,
			FALSE,
			NULL,
			${pickupTime},
			FALSE
		)
		RETURNING id
	`);
	const requestId = request.rows[0].id;

	const pickup = await seedEventGroup(pickupTime, 51.493713, 14.6258545, 'pickup address');
	const dropoff = await seedEventGroup(
		dropoffTime,
		51.50577743128434,
		14.637890411515059,
		'dropoff address'
	);

	await execSQL(sql`
		INSERT INTO event (is_pickup, event_group_id, request, cancelled, communicated_time)
		VALUES
			(TRUE, ${pickup}, ${requestId}, FALSE, ${pickupTime}),
			(FALSE, ${dropoff}, ${requestId}, FALSE, ${dropoffTime})
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

test('Get tours', async ({ page }) => {
	await login(page, TAXI_OWNER);

	const response = await page
		.context()
		.request.get(`/api/driver/tour?fromTime=${fromTime}&toTime=${toTime}`);
	expect(response.status()).toBe(200);

	const responseBody = await response.json();
	expect(responseBody).toHaveLength(2);
	expect(responseBody[0]).toHaveProperty('tourId');
	expect(responseBody[0]).toHaveProperty('events');

	const events = responseBody[0]['events'];
	expect(events).toHaveLength(2);
	expect(events[0]).toHaveProperty('requestId');

	const requestId = events[0]['requestId'];
	expect(requestId).not.toBeNaN();
});

test('Get vehicles', async ({ page }) => {
	await login(page, TAXI_OWNER);

	const response = await page.context().request.get('/api/driver/vehicle');
	expect(response.status()).toBe(200);

	const responseBody = await response.json();
	expect(responseBody).not.toHaveLength(0);
});

test('Set ticket checked', async ({ page }) => {
	await login(page, TAXI_OWNER);

	const toursResponse = await page
		.context()
		.request.get(`/api/driver/tour?fromTime=${fromTime}&toTime=${toTime}`);
	expect(toursResponse.status()).toBe(200);

	const tours = await toursResponse.json();
	expect(tours).toHaveLength(2);
	expect(tours[0]).toHaveProperty('events');

	const events = tours[0]['events'];
	expect(events).toHaveLength(2);
	expect(events[0]).toHaveProperty('requestId');

	const requestId = events[0]['requestId'];
	expect(requestId).not.toBeNaN();

	const ticketCode = 'a7d421840cf89e052d7c1aa74caf66d8';
	await execSQL(sql`UPDATE "request" SET ticket_code = ${ticketCode} WHERE id = ${requestId}`);

	const response1 = await page
		.context()
		.request.put(`/api/driver/ticket?requestId=${requestId}&ticketCode=${ticketCode}`);
	expect(response1.status()).toBe(204);

	const response2 = await page
		.context()
		.request.put(`/api/driver/ticket?requestId="NaN"&ticketCode=${ticketCode}`);
	expect(response2.status()).toBe(400);

	const response3 = await page
		.context()
		.request.put(`/api/driver/ticket?requestId=${requestId}&ticketCode=invalidCode`);
	expect(response3.status()).toBe(404);
});

test('Set tour fare', async ({ page }) => {
	await login(page, TAXI_OWNER);

	const toursResponse = await page
		.context()
		.request.get(`/api/driver/tour?fromTime=${fromTime}&toTime=${toTime}`);
	expect(toursResponse.status()).toBe(200);

	const tours = await toursResponse.json();
	expect(tours).toHaveLength(2);
	expect(tours[0]).toHaveProperty('tourId');

	const tourId = tours[0]['tourId'];
	expect(tourId).not.toBeNaN();

	const fare = 1234;

	const response1 = await page
		.context()
		.request.put(`/api/driver/fare?tourId=${tourId}&fare=${fare}`);
	expect(response1.status()).toBe(204);

	const response2 = await page.context().request.put(`/api/driver/fare?tourId=NaN&fare=${fare}`);
	expect(response2.status()).toBe(400);

	const response3 = await page.context().request.put(`/api/driver/fare?tourId=${tourId}&fare=NaN`);
	expect(response3.status()).toBe(400);
});

type Availability = {
	from: number;
	to: number;
};

async function updateAvailability(
	from: number[],
	to: number[],
	add: boolean[],
	vehicleId: number,
	expected: Availability[],
	page: Page
) {
	const payload = {
		vehicleId,
		from,
		to,
		add,
		offset: offset,
		date: dayString
	};
	const response = await page.context().request.post(`api/driver/availability`, { data: payload });
	expect(response.status()).toBe(200);

	const responseBody = await response.json();
	expect(responseBody).toHaveProperty('tours');
	expect(responseBody).toHaveProperty('vehicles');
	expect(responseBody).toHaveProperty('from');
	expect(responseBody).toHaveProperty('to');
	expect(responseBody).toHaveProperty('add');
	expect(responseBody).not.toHaveProperty('companyDataComplete');
	expect(responseBody).not.toHaveProperty('companyCoordinates');
	expect(responseBody).not.toHaveProperty('utcDate');

	const vehicles = responseBody['vehicles'];
	expect(vehicles).toHaveLength(2);

	expect(responseBody['from']).toEqual(from);
	expect(responseBody['to']).toEqual(to);
	expect(responseBody['add']).toEqual(add);

	const availability = vehicles[0].availability;
	expect(availability).toHaveLength(expected.length);

	let i = 0;
	while (i < availability.length) {
		expect(availability[i].startTime).toEqual(expected[i].from);
		expect(availability[i].endTime).toEqual(expected[i].to);
		i++;
	}

	return availability;
}

test('Update availability', async ({ page }) => {
	await login(page, TAXI_OWNER);

	const licensePlate = 'GR-TU-11';
	const queryRes = await execSQL(
		sql<{ id: number }>`SELECT id FROM vehicle WHERE license_plate = ${licensePlate}`
	);
	const vehicleId = queryRes.rows[0].id;
	const in6Days8am = in6Days.getTime() + HOUR * 7;

	// FETCH
	const availability = await updateAvailability(
		[],
		[],
		[],
		vehicleId,
		[{ from: in6Days8am, to: in6Days8am + HOUR * 3 }],
		page
	);
	const av1 = availability[0];
	expect(av1.startTime).not.toBeFalsy();
	expect(av1.endTime).not.toBeFalsy();

	// UPDATE 1, add availabilty
	const fromTime = in6Days8am + HOUR * 4;
	const toTime = fromTime + MINUTE * 90;

	const expected1: Availability = { from: av1.startTime, to: av1.endTime };
	const expected2: Availability = { from: fromTime, to: toTime };
	await updateAvailability([fromTime], [toTime], [true], vehicleId, [expected1, expected2], page);

	// UPDATE 2, remove availabilty
	const fromTime2 = fromTime + MINUTE * 30;
	const toTime2 = fromTime + HOUR;

	const expected3: Availability = { from: fromTime, to: fromTime2 };
	const expected4: Availability = { from: toTime2, to: toTime };
	await updateAvailability(
		[fromTime2],
		[toTime2],
		[false],
		vehicleId,
		[expected1, expected3, expected4],
		page
	);

	await logout(page);
});
