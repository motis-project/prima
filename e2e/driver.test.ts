import { test, expect } from '@playwright/test';
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

test('Update availability', async ({ page }) => {
	await login(page, TAXI_OWNER);

	// FETCH
	const payload1 = {
		vehicleId: 1,
		from: [],
		to: [],
		add: [],
		offset: offset,
		date: dayString
	};

	const response1 = await page
		.context()
		.request.post(`api/driver/availability`, { data: payload1 });
	expect(response1.status()).toBe(200);

	const responseBody1 = await response1.json();
	expect(responseBody1).toHaveProperty('tours');
	expect(responseBody1).toHaveProperty('vehicles');
	expect(responseBody1).not.toHaveProperty('companyDataComplete');
	expect(responseBody1).not.toHaveProperty('companyCoordinates');
	expect(responseBody1).not.toHaveProperty('utcDate');

	const vehicles1 = responseBody1['vehicles'];
	expect(vehicles1).toHaveLength(2);
	expect(vehicles1[0].availability).toHaveLength(1);

	// UPDATE
	const fromTime = in6Days.getTime() + HOUR * 11;
	const toTime = fromTime + MINUTE * 75;
	const payload2 = {
		vehicleId: vehicles1[0].id,
		from: [fromTime],
		to: [toTime],
		add: [true],
		offset: offset,
		date: dayString
	};

	const response2 = await page
		.context()
		.request.post(`api/driver/availability`, { data: payload2 });
	expect(response2.status()).toBe(200);

	const responseBody2 = await response2.json();
	const vehicles2 = responseBody2['vehicles'];
	expect(vehicles2).toHaveLength(2);
	expect(vehicles2[0].availability).toHaveLength(2);

	const availability = vehicles2[0].availability;
	const av1 = availability[0];
	const av2 = availability[1];
	expect(av1.startTime).toBe(1762758000000);
	expect(av1.endTime).toBe(1762768800000);
	expect(av2.startTime).toBe(fromTime);
	expect(av2.endTime).toBe(toTime);

	await logout(page);
});
