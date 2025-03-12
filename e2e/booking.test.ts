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
	test.setTimeout(600_000);

	await setup(page);
	await login(page, TAXI_OWNER);
	
	// Schleife --> Görlitz (Fwd)
	await page.goto('http://localhost:5173/routing');
	await page.getByRole('textbox', { name: 'Von' }).click();
	await page.getByRole('combobox', { name: 'Von' }).fill('Schleife, Deutschland');
	await page.goBack();
	await page.getByRole('textbox', { name: 'Nach' }).click();
	await page.getByRole('combobox', { name: 'Nach' }).fill('Görlitz, Deutschland');
	await page.goBack();
	await page.getByRole('button', { name: '1 h 19 min 2 Umstiege 20:17' }).click();
	await page.getByRole('button', { name: 'Kostenpflichtig buchen' }).click();
	await page.getByLabel('Kostenpflichtig buchen').getByRole('button', { name: 'Kostenpflichtig buchen' }).click();

	await page.goto('http://localhost:5173/taxi/availability?offset=-60&date=2025-03-10');	
	await expect(page.getByTestId('GR-TU-11-2025-03-10T18:45:00.000Z').locator('div')).toHaveClass('bg-yellow-100');
	await expect(page.getByTestId('GR-TU-11-2025-03-10T19:00:00.000Z').locator('div')).toHaveClass('bg-orange-400');
	await expect(page.getByTestId('GR-TU-11-2025-03-10T19:15:00.000Z').locator('div')).toHaveClass('bg-orange-400');
	await expect(page.getByTestId('GR-TU-11-2025-03-10T19:30:00.000Z').locator('div')).toHaveClass('bg-orange-400');
	await expect(page.getByTestId('GR-TU-11-2025-03-10T19:45:00.000Z').locator('div')).toHaveClass('bg-yellow-100');

	await page.getByTestId('GR-TU-11-2025-03-10T19:00:00.000Z').locator('div').click();
	await expect(page.getByRole('dialog', { name: 'Tour Details' })).toBeVisible();

	// Görlitz --> Schleife (Bwd)
	await page.goto('http://localhost:5173/routing');
	await page.getByRole('button', { name: 'Los um Mo., 10.03.25, 00:' }).click();
	await page.getByRole('radio', { name: 'Ankunft' }).check();
	await page.locator('input[type="datetime-local"]').click();
	await page.locator('input[type="datetime-local"]').fill('2025-03-11T00:00');
	await page.getByRole('button', { name: 'Close' }).click();
	await page.getByRole('textbox', { name: 'Von' }).click();
	await page.getByRole('combobox', { name: 'Von' }).fill('Görlitz, Deutschland');
	await page.getByRole('combobox', { name: 'Von' }).press('Enter');
	await page.getByRole('textbox', { name: 'Nach' }).click();
	await page.getByRole('combobox', { name: 'Nach' }).fill('Schleife, Deutschland');
	await page.getByRole('combobox', { name: 'Nach' }).press('Enter');
	await expect(page.getByRole('button', { name: '1 h 16 min 2 Umstiege 18:21 (' })).toBeVisible();
	await expect(page.getByRole('button', { name: '1 h 17 min 2 Umstiege 19:20 (' })).toBeVisible();
	await page.getByRole('button', { name: '1 h 17 min 2 Umstiege 19:20 (' }).click();
	await page.getByRole('button', { name: 'Kostenpflichtig buchen' }).click();
	await page.getByLabel('Kostenpflichtig buchen').getByRole('button', { name: 'Kostenpflichtig buchen' }).click();

	await page.getByRole('link', { name: 'Verfügbarkeit' }).click();
	await expect(page.getByTestId('GR-TU-12-2025-03-10T19:00:00.000Z').locator('div')).toHaveClass('bg-yellow-100');
	await expect(page.getByTestId('GR-TU-12-2025-03-10T19:15:00.000Z').locator('div')).toHaveClass('bg-orange-400');
	await expect(page.getByTestId('GR-TU-12-2025-03-10T19:30:00.000Z').locator('div')).toHaveClass('bg-orange-400');
	await expect(page.getByTestId('GR-TU-12-2025-03-10T19:45:00.000Z').locator('div')).toHaveClass('bg-orange-400');
	await expect(page.getByTestId('GR-TU-12-2025-03-10T20:00:00.000Z').locator('div')).toHaveClass('bg-yellow-100');
	await page.getByTestId('GR-TU-12-2025-03-10T19:30:00.000Z').locator('div').click();
	await expect(page.getByRole('dialog', { name: 'Tour Details' })).toBeVisible();
	await page.getByRole('button', { name: 'Close' }).click();

await page.goto('http://localhost:5173/routing');
});