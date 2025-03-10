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

	await page.goto('/taxi/availability?offset=-60&date=2025-03-10');
	await page.waitForTimeout(500);
	await markVehicle(page, 'GR-TU-11-2025-03-09T23:00:00.000Z', 'GR-TU-11-2025-03-10T22:45:00.000Z');
	await markVehicle(page, 'GR-TU-12-2025-03-09T23:00:00.000Z', 'GR-TU-12-2025-03-10T22:45:00.000Z');

	await page.goto('/taxi/availability?offset=-60&date=2025-03-11');
	await page.waitForTimeout(500);
	await markVehicle(page, 'GR-TU-11-2025-03-10T23:00:00.000Z', 'GR-TU-11-2025-03-11T22:45:00.000Z');
	await markVehicle(page, 'GR-TU-12-2025-03-10T23:00:00.000Z', 'GR-TU-12-2025-03-11T22:45:00.000Z');

	await page.goto('/taxi/availability?offset=-60&date=2025-03-12');
	await page.waitForTimeout(500);
	await markVehicle(page, 'GR-TU-11-2025-03-11T23:00:00.000Z', 'GR-TU-11-2025-03-12T22:45:00.000Z');
	await markVehicle(page, 'GR-TU-12-2025-03-11T23:00:00.000Z', 'GR-TU-12-2025-03-12T22:45:00.000Z');

	await page.goto('/taxi/availability?offset=-60&date=2025-03-13');
	await page.waitForTimeout(500);
	await markVehicle(page, 'GR-TU-11-2025-03-12T23:00:00.000Z', 'GR-TU-11-2025-03-13T22:45:00.000Z');
	await markVehicle(page, 'GR-TU-12-2025-03-12T23:00:00.000Z', 'GR-TU-12-2025-03-13T22:45:00.000Z');

	await page.goto('/taxi/availability?offset=-60&date=2025-03-14');
	await page.waitForTimeout(500);
	await markVehicle(page, 'GR-TU-11-2025-03-13T23:00:00.000Z', 'GR-TU-11-2025-03-14T22:45:00.000Z');
	await markVehicle(page, 'GR-TU-12-2025-03-13T23:00:00.000Z', 'GR-TU-12-2025-03-14T22:45:00.000Z');

	await page.goto('/taxi/availability?offset=-60&date=2025-03-15');
	await page.waitForTimeout(500);
	await markVehicle(page, 'GR-TU-11-2025-03-14T23:00:00.000Z', 'GR-TU-11-2025-03-15T22:45:00.000Z');
	await markVehicle(page, 'GR-TU-12-2025-03-14T23:00:00.000Z', 'GR-TU-12-2025-03-15T22:45:00.000Z');

	await page.goto('/taxi/availability?offset=-60&date=2025-03-16');
	await page.waitForTimeout(500);
	await markVehicle(page, 'GR-TU-11-2025-03-15T23:00:00.000Z', 'GR-TU-11-2025-03-16T22:45:00.000Z');
	await markVehicle(page, 'GR-TU-12-2025-03-15T23:00:00.000Z', 'GR-TU-12-2025-03-16T22:45:00.000Z');
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