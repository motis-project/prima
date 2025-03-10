import { expect, test, type Page } from '@playwright/test';
import { login, setCompanyData, addVehicle, TAXI_OWNER, COMPANY1, moveMouse, logout } from './utils';

test.describe.configure({ mode: 'serial' });

export async function markVehicle(page: Page, from: string, to: string) {
	await moveMouse(page, from);
	await page.mouse.down();
	await moveMouse(page, to);
	await page.mouse.up();
}

export async function setAvailable(page: Page) {
	await login(page, TAXI_OWNER);

	await page.goto('/taxi/availability?offset=-60&date=2025-11-01');
	await page.waitForTimeout(500);
	await markVehicle(page, 'GR-TU-11-2025-10-31T23:00:00.000Z', 'GR-TU-11-2025-11-01T22:45:00.000Z');
	await markVehicle(page, 'GR-TU-12-2025-10-31T23:00:00.000Z', 'GR-TU-12-2025-11-01T22:45:00.000Z');

	await page.goto('/taxi/availability?offset=-60&date=2025-11-02');
	await page.waitForTimeout(500);
	await markVehicle(page, 'GR-TU-11-2025-11-01T23:00:00.000Z', 'GR-TU-11-2025-11-02T22:45:00.000Z');
	await markVehicle(page, 'GR-TU-12-2025-11-01T23:00:00.000Z', 'GR-TU-12-2025-11-02T22:45:00.000Z');

	await page.goto('/taxi/availability?offset=-60&date=2025-11-03');
	await page.waitForTimeout(500);
	await markVehicle(page, 'GR-TU-11-2025-11-02T23:00:00.000Z', 'GR-TU-11-2025-11-03T22:45:00.000Z');
	await markVehicle(page, 'GR-TU-12-2025-11-02T23:00:00.000Z', 'GR-TU-12-2025-11-03T22:45:00.000Z');

	await page.goto('/taxi/availability?offset=-60&date=2025-11-04');
	await page.waitForTimeout(500);
	await markVehicle(page, 'GR-TU-11-2025-11-03T23:00:00.000Z', 'GR-TU-11-2025-11-04T22:45:00.000Z');
	await markVehicle(page, 'GR-TU-12-2025-11-03T23:00:00.000Z', 'GR-TU-12-2025-11-04T22:45:00.000Z');

	await page.goto('/taxi/availability?offset=-60&date=2025-11-05');
	await page.waitForTimeout(500);
	await markVehicle(page, 'GR-TU-11-2025-11-04T23:00:00.000Z', 'GR-TU-11-2025-11-05T22:45:00.000Z');
	await markVehicle(page, 'GR-TU-12-2025-11-04T23:00:00.000Z', 'GR-TU-12-2025-11-05T22:45:00.000Z');

	await page.goto('/taxi/availability?offset=-60&date=2025-11-06');
	await page.waitForTimeout(500);
	await markVehicle(page, 'GR-TU-11-2025-11-05T23:00:00.000Z', 'GR-TU-11-2025-11-06T22:45:00.000Z');
	await markVehicle(page, 'GR-TU-12-2025-11-05T23:00:00.000Z', 'GR-TU-12-2025-11-06T22:45:00.000Z');

	await page.goto('/taxi/availability?offset=-60&date=2025-11-07');
	await page.waitForTimeout(500);
	await markVehicle(page, 'GR-TU-11-2025-11-06T23:00:00.000Z', 'GR-TU-11-2025-11-07T22:45:00.000Z');
	await markVehicle(page, 'GR-TU-12-2025-11-06T23:00:00.000Z', 'GR-TU-12-2025-11-07T22:45:00.000Z');
}

export async function setup(page: Page) {
	await setCompanyData(page, TAXI_OWNER, COMPANY1);
	await logout(page);
	await addVehicle(page,'GR-TU-11');
	await logout(page);
	await addVehicle(page,'GR-TU-12');
	await logout(page);
	await setAvailable(page);
	await logout(page);
}

test('Boooking', async ({ page }) => {
	await setup(page);

	//TODO record bookings
	await login(page, TAXI_OWNER);
	
});