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


/* Requirements
- set PUBLIC_SIMULATION_TIME=2025-03-10T00:00:00+0100 in .env
- Motis: Use OSM, GTFS and config.yml from this link:
  https://next.hessenbox.de/index.php/s/pHPpdj3aBNarQg9
*/
test('Boooking', async ({ page }) => {
	test.setTimeout(600_000);

	await setup(page);
	await login(page, TAXI_OWNER);
	
	// Schleife --> Görlitz (Fwd)
	await page.goto('http://localhost:5173/routing');
	await page.getByRole('textbox', { name: 'Von' }).click();
	await page.getByRole('combobox', { name: 'Von' }).pressSequentially('Schleife, Deutschland', {delay: 50});
	await page.getByRole('option', { name: 'Schleife Deutschland' }).click();
	await page.getByRole('textbox', { name: 'Nach' }).click();
	await page.getByRole('combobox', { name: 'Nach' }).pressSequentially('Görlitz, Deutschland', {delay: 50});
	await page.getByRole('option', { name: 'Görlitz Deutschland' }).click();
	await page.getByRole('button', { name: '1 h 19 min 2 Umstiege 20:17' }).click();
	await page.getByRole('button', { name: 'Kostenpflichtig buchen' }).click();
	await page.getByLabel('Kostenpflichtig buchen').getByRole('button', { name: 'Kostenpflichtig buchen' }).click();

	await page.goto('http://localhost:5173/taxi/availability?offset=-60&date=2025-03-10');	
	await expect(page.getByTestId('GR-TU-11-2025-03-10T18:45:00.000Z').locator('div')).toHaveClass(/bg-yellow-100/);
	await expect(page.getByTestId('GR-TU-11-2025-03-10T19:00:00.000Z').locator('div')).toHaveClass(/bg-orange-400/);
	await expect(page.getByTestId('GR-TU-11-2025-03-10T19:15:00.000Z').locator('div')).toHaveClass(/bg-orange-400/);
	await expect(page.getByTestId('GR-TU-11-2025-03-10T19:30:00.000Z').locator('div')).toHaveClass(/bg-orange-400/);
	await expect(page.getByTestId('GR-TU-11-2025-03-10T19:45:00.000Z').locator('div')).toHaveClass(/bg-yellow-100/);

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
	await page.getByRole('combobox', { name: 'Von' }).pressSequentially('Görlitz, Deutschland', {delay: 50});
	await page.getByRole('option', { name: 'Görlitz Deutschland' }).click();
	await page.getByRole('textbox', { name: 'Nach' }).click();
	await page.getByRole('combobox', { name: 'Nach' }).pressSequentially('Schleife, Deutschland', {delay: 50});
	await page.getByRole('option', { name: 'Schleife Deutschland' }).click();
	await expect(page.getByRole('button', { name: '1 h 16 min 2 Umstiege 18:21 (' })).toBeVisible();
	await expect(page.getByRole('button', { name: '1 h 17 min 2 Umstiege 19:20 (' })).toBeVisible();
	await page.getByRole('button', { name: '1 h 17 min 2 Umstiege 19:20 (' }).click();
	await page.getByRole('button', { name: 'Kostenpflichtig buchen' }).click();
	await page.getByLabel('Kostenpflichtig buchen').getByRole('button', { name: 'Kostenpflichtig buchen' }).click();

	await page.getByRole('link', { name: 'Verfügbarkeit' }).click();
	await expect(page.getByTestId('GR-TU-12-2025-03-10T19:00:00.000Z').locator('div')).toHaveClass(/bg-yellow-100/);
	await expect(page.getByTestId('GR-TU-12-2025-03-10T19:15:00.000Z').locator('div')).toHaveClass(/bg-orange-400/);
	await expect(page.getByTestId('GR-TU-12-2025-03-10T19:30:00.000Z').locator('div')).toHaveClass(/bg-orange-400/);
	await expect(page.getByTestId('GR-TU-12-2025-03-10T19:45:00.000Z').locator('div')).toHaveClass(/bg-orange-400/);
	await expect(page.getByTestId('GR-TU-12-2025-03-10T20:00:00.000Z').locator('div')).toHaveClass(/bg-yellow-100/);
	await page.getByTestId('GR-TU-12-2025-03-10T19:30:00.000Z').locator('div').click();
	await expect(page.getByRole('dialog', { name: 'Tour Details' })).toBeVisible();
	await page.getByRole('button', { name: 'Close' }).click();

	// Stornieren: Schleife --> Görlitz
	await page.getByRole('link', {name: 'Abrechnung' }).click();
	await expect(page.locator('#searchmask-container')).toContainText('Fahrzeug Abfahrt Ankunft Kundenerschienene Kunden Taxameterstand Kosten GR-TU-1110.03.2025, 20:0510.03.2025, 20:40100.00€0.00€GR-TU-1210.03.2025, 20:1510.03.2025, 20:50100.00€0.00€');
  	await page.getByRole('link', { name: 'Verfügbarkeit' }).click();
  	await page.getByTestId('GR-TU-11-2025-03-10T19:30:00.000Z').locator('div').click();
  	await page.getByText('Stornieren').click();
  	await page.getByRole('textbox').fill('Test23');
  	await page.getByRole('button', { name: 'Stornieren bestätigen' }).click();

	await expect(page.getByTestId('GR-TU-11-2025-03-10T18:45:00.000Z').locator('div')).toHaveClass(/bg-yellow-100/);
	await expect(page.getByTestId('GR-TU-11-2025-03-10T19:00:00.000Z').locator('div')).toHaveClass(/bg-yellow-100/);
	await expect(page.getByTestId('GR-TU-11-2025-03-10T19:15:00.000Z').locator('div')).toHaveClass(/bg-yellow-100/);
	await expect(page.getByTestId('GR-TU-11-2025-03-10T19:30:00.000Z').locator('div')).toHaveClass(/bg-yellow-100/);
	await expect(page.getByTestId('GR-TU-11-2025-03-10T19:45:00.000Z').locator('div')).toHaveClass(/bg-yellow-100/);

  	await page.getByRole('link', { name: 'Abrechnung' }).click();
  	await page.getByRole('combobox').nth(4).selectOption('0');
	await expect(page.locator('#searchmask-container')).toContainText('Fahrzeug Abfahrt Ankunft Kundenerschienene Kunden Taxameterstand Kosten GR-TU-1110.03.2025, 20:0510.03.2025, 20:40100.00€0.00€');
  	await page.getByRole('combobox').nth(4).selectOption('1');
  	await expect(page.locator('#searchmask-container')).toContainText('Fahrzeug Abfahrt Ankunft Kundenerschienene Kunden Taxameterstand Kosten GR-TU-1210.03.2025, 20:1510.03.2025, 20:50100.00€0.00€');
});