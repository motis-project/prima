import { test } from '@playwright/test';
import { login, ENTREPENEUR } from './utils';

test('Redispose tour', async ({ page }) => {
	await login(page, ENTREPENEUR);
	await page.goto('/taxi?offset=-120&date=2026-09-30');
	await page.waitForTimeout(500);

	await page
		.locator('.cursor-pointer').first()
		.click();
	await page.getByText('Tour redisponieren').click();
	await page.getByText('Bestätigen').click();
	await page.getByText('Ok').click();
	await page.getByRole('button', { name: 'cross 2, Close' }).click();

	// TODO: check
});
