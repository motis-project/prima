import { expect, test } from '@playwright/test';

test('Set company data, incomplete 1', async ({ page }) => {
	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();

	await page.getByLabel('Name').fill('Test');
	await page.getByRole('button', { name: 'Übernehmen' }).click();

	await expect(page.getByText('Adresse zu kurz.')).toBeVisible();
});
