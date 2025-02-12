import { test, expect } from '@playwright/test';
import { TAXI_OWNER, execSQL, login } from './utils';
import { sql } from 'kysely';


test('Get tours', async ({ page }) => {
    await login(page, TAXI_OWNER);

    const response = await page.context().request.get('/api/driver/tour?fromTime=1790726400000&toTime=1790812799000');
    expect(response.status()).toBe(200);

    const responseBody = await response.json();
    expect(responseBody).toHaveLength(1);
    expect(responseBody[0]).toHaveProperty('tourId');
    expect(responseBody[0]).toHaveProperty('licensePlate', 'GR-TU-11');
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
    expect(responseBody).toHaveLength(1);
    expect(responseBody[0]).toHaveProperty('licensePlate', 'GR-TU-11');
});

test('Set ticket checked', async ({ page }) => {
    await login(page, TAXI_OWNER);

    const toursResponse = await page.context().request.get('/api/driver/tour?fromTime=1790726400000&toTime=1790812799000');
    expect(toursResponse.status()).toBe(200);

    const tours = await toursResponse.json();
    expect(tours).toHaveLength(1);
    expect(tours[0]).toHaveProperty('events');

    const events = tours[0]['events'];
    expect(events).toHaveLength(2);
    expect(events[0]).toHaveProperty('requestId');

    const requestId = events[0]['requestId'];
    expect(requestId).not.toBeNaN();

    const ticketCode = 'a7d421840cf89e052d7c1aa74caf66d8';
    await execSQL(sql`UPDATE "request" SET ticket_code = ${ticketCode} WHERE id = ${requestId}`);

    const response = await page.context().request.post(`/api/driver/ticket?requestId=${requestId}&ticketCode=${ticketCode}`);
    expect(response.status()).toBe(200);
});

test('Set tour fare', async ({ page }) => {
    await login(page, TAXI_OWNER);

    const toursResponse = await page.context().request.get('/api/driver/tour?fromTime=1790726400000&toTime=1790812799000');
    expect(toursResponse.status()).toBe(200);

    const tours = await toursResponse.json();
    expect(tours).toHaveLength(1);
    expect(tours[0]).toHaveProperty('tourId');

    const tourId = tours[0]['tourId'];
    expect(tourId).not.toBeNaN();

    const fare = 1234;

    const response = await page.context().request.post(`/api/driver/fare?tourId=${tourId}&fare=${fare}`);
    expect(response.status()).toBe(200);
});