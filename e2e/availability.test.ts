import { expect, test, type Page } from '@playwright/test';
import { login, setCompanyData, addVehicle, TAXI_OWNER, COMPANY1, moveMouse } from './utils';

test.describe.configure({ mode: 'serial' });

export async function setAvailability(page: Page) {
	await login(page, TAXI_OWNER);
	await page.goto('/taxi/availability?offset=-120&date=2026-09-30');
	await page.waitForTimeout(500);

	await moveMouse(page, 'GR-TU-11-2026-09-30T08:00:00.000Z');
	await page.mouse.down();
	await moveMouse(page, 'GR-TU-11-2026-09-30T08:45:00.000Z');
	await page.mouse.up();
}

export async function requestRide(page: Page) {
	await login(page, TAXI_OWNER);
	await page.goto('/debug');
	await page.waitForTimeout(1000);

	await page.getByRole('textbox').fill('2026-09-30T08:30:00Z');
	await page.getByRole('button', { name: 'Suchen' }).click();
	await expect(page.getByText('Tour ID: ')).toBeVisible();
}

test('Set company data', async ({ page }) => {
	await setCompanyData(page, TAXI_OWNER, COMPANY1);
});

test('Add vehicle', async ({ page }) => {
	await addVehicle(page, 'GR-TU-11');
	await expect(page.getByRole('cell', { name: 'GR-TU-11' }).first()).toBeVisible();
});

test('Set availability', async ({ page }) => {
	await setAvailability(page);
	await expect(
		page.locator(
			'table:nth-child(2) > tbody > tr > td:nth-child(3) > .w-full > tbody > tr > td:nth-child(4) > .w-8'
		)
	).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	await expect(
		page
			.locator(
				'table:nth-child(2) > tbody > tr > td:nth-child(4) > .w-full > tbody > tr > td > .w-8'
			)
			.first()
	).toHaveCSS('background-color', 'rgb(254, 249, 195)');
	await expect(
		page.locator(
			'table:nth-child(2) > tbody > tr > td:nth-child(4) > .w-full > tbody > tr > td:nth-child(2) > .w-8'
		)
	).toHaveCSS('background-color', 'rgb(254, 249, 195)');
	await expect(
		page.locator(
			'table:nth-child(2) > tbody > tr > td:nth-child(4) > .w-full > tbody > tr > td:nth-child(3) > .w-8'
		)
	).toHaveCSS('background-color', 'rgb(254, 249, 195)');
	await expect(
		page.locator(
			'table:nth-child(2) > tbody > tr > td:nth-child(4) > .w-full > tbody > tr > td:nth-child(4) > .w-8'
		)
	).toHaveCSS('background-color', 'rgb(254, 249, 195)');
	await expect(
		page
			.locator(
				'table:nth-child(2) > tbody > tr > td:nth-child(5) > .w-full > tbody > tr > td > .w-8'
			)
			.first()
	).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('Request ride', async ({ page }) => {
	await requestRide(page);
	await page.goto('/taxi/availability?offset=-120&date=2026-09-30');
	await page.waitForTimeout(500);
	await expect(page.getByTestId('GR-TU-11-2026-09-30T07:45:00.000Z').locator('div')).toHaveCSS(
		'background-color',
		'rgba(0, 0, 0, 0)'
	);
	await expect(page.getByTestId('GR-TU-11-2026-09-30T08:00:00.000Z').locator('div')).toHaveCSS(
		'background-color',
		'rgb(251, 146, 60)'
	);
	await expect(page.getByTestId('GR-TU-11-2026-09-30T08:15:00.000Z').locator('div')).toHaveCSS(
		'background-color',
		'rgb(251, 146, 60)'
	);
	await expect(page.getByTestId('GR-TU-11-2026-09-30T08:30:00.000Z').locator('div')).toHaveCSS(
		'background-color',
		'rgb(251, 146, 60)'
	);
	await expect(page.getByTestId('GR-TU-11-2026-09-30T08:45:00.000Z').locator('div')).toHaveCSS(
		'background-color',
		'rgb(251, 146, 60)'
	);
	await expect(page.getByTestId('GR-TU-11-2026-09-30T09:00:00.000Z').locator('div')).toHaveCSS(
		'background-color',
		'rgba(0, 0, 0, 0)'
	);
});
