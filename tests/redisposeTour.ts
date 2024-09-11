import { test } from '@playwright/test';
import { login, ENTREPENEUR } from './utils';

test('Redispose tour', async ({ page }) => {
	await login(page, ENTREPENEUR);
	await page.goto('/taxi?offset=-120&date=2026-09-30');
	await page.waitForTimeout(1000);

	await page
		.locator('table:nth-child(2) > tbody > tr > td:nth-child(4) > .w-full > tbody > tr > td > .w-8')
		.first()
		.click();
	await page.getByText('Tour redisponieren').click();
	await page.getByText('Bestätigen').click();
	await page.getByText('Ok').click();
	await page.getByRole('button', { name: 'cross 2, Close' }).click();

	// TODO: check
});
