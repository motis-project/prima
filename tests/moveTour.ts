import { test, expect } from '@playwright/test';
import { addVehicle } from './utils';

test('Move tour to other vehicle', async ({ page }) => {
	await addVehicle(page, 'GR-TU-12');

	await page.goto('/taxi?offset=-120&date=2026-09-30');
	await page.waitForTimeout(500);

	await expect(
		page
			.locator(
				'table:nth-child(2) > tbody > tr > td:nth-child(4) > .w-full > tbody > tr > td > .w-8'
			)
			.first()
	).toHaveCSS('background-color', 'rgb(251, 146, 60)');

	await page.mouse.move(425, 505);
	await page.mouse.down();
	await page.mouse.move(425, 540);
	await page.waitForTimeout(100);
	await page.mouse.up();

	await expect(
		page
			.locator(
				'table:nth-child(2) > tbody > tr > td:nth-child(4) > .w-full > tbody > tr > td > .w-8'
			)
			.first()
	).toHaveCSS('background-color', 'rgb(254, 249, 195)');
	await expect(page.locator('.cursor-pointer').first()).toHaveCSS(
		'background-color',
		'rgb(251, 146, 60)'
	);
});
