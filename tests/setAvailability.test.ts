import { expect, test } from '@playwright/test';
import { login, ENTREPENEUR } from './utils';

test.describe.configure({ mode: 'serial' });

test('Set company data, complete and consistent', async ({ page }) => {
	await login(page, ENTREPENEUR);
	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();

	await page.getByLabel('Name').fill('Taxi Weißwasser');
	await page
		.getByLabel('Unternehmenssitz')
		.fill('Werner-Seelenbinder-Straße 70A, 02943 Weißwasser/Oberlausitz');
	await page.waitForTimeout(250);
	await page.getByLabel('Pflichtfahrgebiet').selectOption({ label: 'Weißwasser' });
	await page.getByLabel('Gemeinde').selectOption({ label: 'Weißwasser/O.L.' });
	await page.getByRole('button', { name: 'Übernehmen' }).click();
});

test('Set availability', async ({ page }) => {
	await login(page, ENTREPENEUR);
	await page.getByRole('link', { name: 'Taxi' }).click();
	await expect(page.getByRole('heading', { name: 'Fahrzeuge und Touren' })).toBeVisible();
	await page.waitForTimeout(500);
	await page.getByRole('button', { name: 'Fahrzeug hinzufügen' }).click();
	await page.getByPlaceholder('DA-AB-1234').fill('GR-TU-11');
	await page.getByLabel('3 Passagiere').check();
	await page
		.locator('button')
		.filter({ hasText: /^Fahrzeug hinzufügen$/ })
		.click();

	await page.goto('/taxi?offset=-120&date=2024-09-12');
	await page.waitForTimeout(500);
	await page
		.locator(
			'table:nth-child(3) > tbody > tr > td:nth-child(4) > .w-full > tbody > tr > td:nth-child(1) > .w-8'
		)
		.click();
	await page
		.locator(
			'table:nth-child(3) > tbody > tr > td:nth-child(4) > .w-full > tbody > tr > td:nth-child(2) > .w-8'
		)
		.click();
	await page
		.locator(
			'table:nth-child(3) > tbody > tr > td:nth-child(4) > .w-full > tbody > tr > td:nth-child(3) > .w-8'
		)
		.click();
	await page
		.locator(
			'table:nth-child(3) > tbody > tr > td:nth-child(4) > .w-full > tbody > tr > td:nth-child(4) > .w-8'
		)
		.click();
});

test('Request ride', async ({ page }) => {
	await login(page, ENTREPENEUR);
	await page.goto('/request');
	await page.getByRole('textbox').fill('');
	await page.keyboard.down('0');
	await page.keyboard.down('9');
	await page.keyboard.down('1');
	await page.keyboard.down('2');
	await page.keyboard.down('2');
	await page.keyboard.down('0');
	await page.keyboard.down('2');
	await page.keyboard.down('4');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.down('1');
	await page.keyboard.down('9');
	await page.keyboard.down('4');
	await page.keyboard.down('0');
	await page.getByRole('button', { name: 'Suchen' }).click();
	await expect(page.getByRole('heading', { name: ': OK' })).toHaveText('200: OK');
});
