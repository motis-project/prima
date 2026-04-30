import { expect, test, type Page } from '@playwright/test';
import { hashPassword } from '../src/lib/server/auth/password';
import { login, addVehicle, TAXI_OWNER, moveMouse, offset, dayString, logout } from './utils';
import { clearSessionsForUser, seedUser, seedWeisswasserCompany } from './testData';

test.describe.configure({ mode: 'serial' });

let taxiOwnerPasswordHash: string;

test.beforeAll(async () => {
	taxiOwnerPasswordHash = await hashPassword(TAXI_OWNER.password);

	await clearSessionsForUser(TAXI_OWNER.email);
	const companyId = await seedWeisswasserCompany();
	await seedUser({
		email: TAXI_OWNER.email,
		passwordHash: taxiOwnerPasswordHash,
		companyId,
		isTaxiOwner: true,
		upsert: true
	});
});

export async function setAvailability(page: Page) {
	await login(page, TAXI_OWNER);
	await page.goto(`/taxi/availability?offset=${offset}&date=${dayString}`);
	await page.waitForTimeout(500);
	page.getByTestId(`GR-TU-11-${dayString}T09:45:00.000Z`).locator('div').scrollIntoViewIfNeeded();
	await page.waitForTimeout(500);
	await moveMouse(page, `GR-TU-11-${dayString}T07:00:00.000Z`);
	await page.mouse.down();
	await moveMouse(page, `GR-TU-11-${dayString}T09:45:00.000Z`);
	await page.mouse.up();
}

export async function requestRide(page: Page) {
	await login(page, TAXI_OWNER);
	await page.goto('/debug');
	await page.waitForTimeout(1000);

	await page.getByRole('textbox').fill(`${dayString}T08:30:00Z`);
	await page.getByRole('button', { name: 'Suchen' }).click();
	await expect(page.getByText('Request: ')).toBeVisible();
}

test('Add vehicle', async ({ page }) => {
	await addVehicle(page, 'GR-TU-11');
	await expect(page.getByRole('cell', { name: 'GR-TU-11' }).first()).toBeVisible();
});

test('Set availability', async ({ page }) => {
	await setAvailability(page);
	await expect(page.getByTestId(`GR-TU-11-${dayString}T06:45:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgba(0, 0, 0, 0)'
	);
	await expect(page.getByTestId(`GR-TU-11-${dayString}T07:00:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(254, 249, 195)'
	);
	await expect(page.getByTestId(`GR-TU-11-${dayString}T07:15:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(254, 249, 195)'
	);
	await expect(page.getByTestId(`GR-TU-11-${dayString}T09:30:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(254, 249, 195)'
	);
	await expect(page.getByTestId(`GR-TU-11-${dayString}T09:45:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(254, 249, 195)'
	);
	await expect(page.getByTestId(`GR-TU-11-${dayString}T10:00:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgba(0, 0, 0, 0)'
	);
});

test('Request ride', async ({ page }) => {
	await requestRide(page);
	await page.goto(`/taxi/availability?offset=${offset}&date=${dayString}`);
	await page.waitForTimeout(500);
	await expect(page.getByTestId(`GR-TU-11-${dayString}T08:00:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(251, 146, 60)'
	);
	await expect(page.getByTestId(`GR-TU-11-${dayString}T08:15:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(251, 146, 60)'
	);
	await expect(page.getByTestId(`GR-TU-11-${dayString}T08:30:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(251, 146, 60)'
	);
	await logout(page);
});
