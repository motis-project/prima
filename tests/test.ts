import { expect, test } from '@playwright/test';

test('short password declined', async ({ page }) => {
	await page.goto('/signup');
	await expect(page.getByRole('heading', { name: 'Neuen Account erstellen' })).toBeVisible();
	await page.getByLabel('Email').fill('mail@example.com');
	await page.getByLabel('Password').fill('shrt');
	await page.getByRole('button', { name: 'Account erstellen' }).click();
	await expect(page.getByText('Invalid password')).toBeVisible();
});
