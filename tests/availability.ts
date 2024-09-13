import { expect, test, type Page } from '@playwright/test';
import { login, setCompanyData, addVehicle, ENTREPENEUR, COMPANY1 } from './utils';

export async function setAvailability(page: Page) {
	await login(page, ENTREPENEUR);
	await page.goto('/taxi?offset=-120&date=2026-09-30');
	await page.waitForTimeout(2000);

	await page.mouse.move(425, 465);
	await page.mouse.down();
	await page.mouse.move(525, 465);
	await page.mouse.up();
}

export async function requestRide(page: Page) {
	await login(page, ENTREPENEUR);
	await page.goto('/request');
	await page.waitForTimeout(500);

	await page.getByRole('textbox').fill('2026-09-30T08:40:00Z');
	await page.getByRole('button', { name: 'Suchen' }).click();
	await page.waitForTimeout(500);
	await expect(page.getByRole('heading', { name: ': OK' })).toHaveText('200: OK');
}

test.describe.configure({ mode: 'serial' });

test('Set company data', async ({ page }) => {
	await setCompanyData(page, ENTREPENEUR, COMPANY1);
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
	await page.goto('/taxi?offset=-120&date=2026-09-30');
	await page.waitForTimeout(2000);
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
	).toHaveCSS('background-color', 'rgb(251, 146, 60)');
	await expect(
		page.locator(
			'table:nth-child(2) > tbody > tr > td:nth-child(4) > .w-full > tbody > tr > td:nth-child(2) > .w-8'
		)
	).toHaveCSS('background-color', 'rgb(251, 146, 60)');
	await expect(
		page.locator(
			'table:nth-child(2) > tbody > tr > td:nth-child(4) > .w-full > tbody > tr > td:nth-child(3) > .w-8'
		)
	).toHaveCSS('background-color', 'rgb(251, 146, 60)');
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
