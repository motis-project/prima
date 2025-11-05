import { test, expect, Page } from '@playwright/test';
import { sql } from 'kysely';
import { DAY, HOUR, MINUTE, SECOND } from '../src/lib/util/time';
import { login, in6Days, execSQL, TAXI_OWNER, offset, dayString, logout } from './utils';

const fromTime = in6Days.getTime();
const toTime = in6Days.getTime() + DAY - SECOND;

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
	from: number,
	to: number,
	add: boolean,
	vehicleId: number,
	expected: Availability[],
	page: Page
) {
	const payload = {
		vehicleId,
		from: [from],
		to: [to],
		add: [add],
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

	expect(responseBody['from'][0]).toBe(from);
	expect(responseBody['to'][0]).toBe(to);
	expect(responseBody['add'][0]).toBe(add);

	const availability = vehicles[0].availability;
	expect(availability).toHaveLength(expected.length);

	let i = 0;
	while (i < availability.length) {
		expect(availability[i].startTime).toBe(expected[i].from);
		expect(availability[i].endTime).toBe(expected[i].to);
		i++;
	}
}

test('Update availability', async ({ page }) => {
	await login(page, TAXI_OWNER);

	const licensePlate = 'GR-TU-11';
	const queryRes = await execSQL(
		sql<{ id: number }>`SELECT id FROM vehicle WHERE license_plate = ${licensePlate}`
	);
	const vehicleId = queryRes.rows[0].id;

	// FETCH
	const payload = {
		vehicleId: vehicleId,
		from: [],
		to: [],
		add: [],
		offset: offset,
		date: dayString
	};
	const response = await page.context().request.post(`api/driver/availability`, { data: payload });
	expect(response.status()).toBe(200);

	const responseBody = await response.json();

	const vehicles = responseBody['vehicles'];
	expect(vehicles).toHaveLength(2);
	expect(vehicles[0].availability).toHaveLength(1);

	const av1 = vehicles[0].availability[0];

	// UPDATE 1, add availabilty
	const fromTime = in6Days.getTime() + HOUR * 11;
	const toTime = fromTime + MINUTE * 90;

	const expected1: Availability = { from: av1.startTime, to: av1.endTime };
	const expected2: Availability = { from: fromTime, to: toTime };
	await updateAvailability(fromTime, toTime, true, vehicleId, [expected1, expected2], page);

	// UPDATE 2, remove availabilty
	const fromTime2 = fromTime + MINUTE * 30;
	const toTime2 = fromTime + HOUR;

	const expected3: Availability = { from: fromTime, to: fromTime2 };
	const expected4: Availability = { from: toTime2, to: toTime };
	await updateAvailability(
		fromTime2,
		toTime2,
		false,
		vehicleId,
		[expected1, expected3, expected4],
		page
	);

	await logout(page);
});
