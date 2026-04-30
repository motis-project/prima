import { test, expect } from '@playwright/test';
import { sql } from 'kysely';
import { hashPassword } from '../src/lib/server/auth/password';
import { HOUR, MINUTE } from '../src/lib/util/time';
import { addVehicle, moveMouse, offset, dayString, execSQL, in6Days, TAXI_OWNER } from './utils';

test.beforeAll(async () => {
	const taxiOwnerPasswordHash = await hashPassword(TAXI_OWNER.password);

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
			${TAXI_OWNER.email},
			${TAXI_OWNER.email},
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
		)
		RETURNING id
	`);
	const userId = user.rows[0].id;

	const vehicle = await execSQL<{ id: number }>(sql`
		INSERT INTO vehicle (license_plate, company, passengers, wheelchairs, bikes, luggage)
		VALUES ('GR-TU-11', ${companyId}, 4, 0, 0, 4)
		RETURNING id
	`);
	const vehicleId = vehicle.rows[0].id;

	const availabilityStart = in6Days.getTime() + HOUR * 7;
	await execSQL(sql`
		INSERT INTO availability (start_time, end_time, vehicle)
		VALUES (${availabilityStart}, ${availabilityStart + HOUR * 3}, ${vehicleId})
	`);

	await seedTour(
		vehicleId,
		userId,
		availabilityStart + HOUR,
		availabilityStart + HOUR + MINUTE * 30
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

test('Move tour to vehicle with cancelled tour', async ({ page }) => {
	await addVehicle(page, 'GR-TU-12');
	// Move Tour
	await page.waitForTimeout(500);
	await page.goto(`/taxi/availability?offset=${offset}&date=${dayString}`);
	await page.waitForTimeout(1000);

	await moveMouse(page, `GR-TU-11-${dayString}T08:00:00.000Z`);
	await page.mouse.down();
	await moveMouse(page, `GR-TU-12-${dayString}T08:00:00.000Z`);
	await page.mouse.up();
	await page.waitForTimeout(500);

	await expect(page.getByTestId(`GR-TU-11-${dayString}T08:00:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(254, 249, 195)'
	);
	await expect(page.getByTestId(`GR-TU-12-${dayString}T08:00:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(251, 146, 60)'
	);
	// Open TourDialog
	await page.mouse.down();
	await page.mouse.up();
	// Cancel Tour
	await page.getByText('Stornieren').click();
	await page.getByRole('textbox').fill('test');
	await page.getByText('Stornieren bestätigen').click();
	// Book new Tour
	await page.goto('/debug');

	await page.getByRole('textbox').fill(`${dayString}T08:30:00Z`);
	await page.getByRole('button', { name: 'Suchen' }).click();
	await expect(page.getByText('Request: ')).toBeVisible();

	await page.goto(`/taxi/availability?offset=${offset}&date=${dayString}`);
	await page.waitForTimeout(1000);
	// Move Tour to vehicle with cancelled Tour
	await moveMouse(page, `GR-TU-11-${dayString}T08:00:00.000Z`);
	await page.mouse.down();
	await moveMouse(page, `GR-TU-12-${dayString}T08:00:00.000Z`);
	await page.mouse.up();

	await expect(page.getByTestId(`GR-TU-11-${dayString}T08:00:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(254, 249, 195)'
	);
	await expect(page.getByTestId(`GR-TU-12-${dayString}T08:00:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(251, 146, 60)'
	);
});
