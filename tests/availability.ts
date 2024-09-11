import { expect, test, type Page } from '@playwright/test';
import { login, setCompanyData, addVehicle, ENTREPENEUR, COMPANY1 } from './utils';

export async function setAvailability(page: Page) {
	await login(page, ENTREPENEUR);
	await page.goto('/taxi?offset=-120&date=2026-09-30');
	await page.waitForTimeout(500);

	await page.mouse.move(425, 465);
	await page.mouse.down();
	await page.mouse.move(525, 465);
	await page.mouse.up();
}

export async function requestRide(page: Page) {
	await login(page, ENTREPENEUR);
	await page.goto('/request');
	await page.waitForTimeout(500);

	await page.getByRole('textbox').fill('');
	await page.keyboard.down('0');
	await page.keyboard.down('9');
	await page.keyboard.down('3');
	await page.keyboard.down('0');
	await page.keyboard.down('2');
	await page.keyboard.down('0');
	await page.keyboard.down('2');
	await page.keyboard.down('6');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.down('1');
	await page.keyboard.down('0');
	await page.keyboard.down('4');
	await page.keyboard.down('0');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.down('A');
	await page.getByRole('button', { name: 'Suchen' }).click();
	await expect(page.getByRole('heading', { name: ': OK' })).toHaveText('200: OK');
}

test.describe.configure({ mode: 'serial' });

test('Set company data', async ({ page }) => {
	await setCompanyData(page, ENTREPENEUR, COMPANY1);
});

test('Add vehicle', async ({ page }) => {
	await addVehicle(page, 'GR-TU-11');
	// TODO: check
});

test('Set availability', async ({ page }) => {
	await setAvailability(page);
	// TODO: check
});

test('Request ride', async ({ page }) => {
	await requestRide(page);
	// TODO: check
});
