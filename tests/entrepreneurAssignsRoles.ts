import { expect, test } from '@playwright/test';
import { ENTREPENEUR, setCompanyData, signup, COMPANY1, login } from './utils';

test.describe.configure({ mode: 'serial' });

test('Activate drivers', async ({ page }) => {
	await signup(page, { email: 'driver1@test.de', password: 'longEnough2' });
	await signup(page, { email: 'driver2@test.de', password: 'longEnough2' });
	await setCompanyData(page, ENTREPENEUR, COMPANY1);

	await page.getByRole('link', { name: 'Fahrer' }).click();
	await page.waitForTimeout(200);
	await page.getByPlaceholder('Email').fill('driver1@test.de');
	await page.getByRole('button', { name: 'Freischalten' }).click();
	await expect(page.getByText('Freischaltung erfolgreich!')).toBeVisible();
	await expect(page.getByRole('cell', { name: 'driver1@test.de' })).toHaveText('driver1@test.de');

	await page.reload();
	await expect(page.getByRole('cell', { name: 'driver1@test.de' })).toHaveText('driver1@test.de');
	await page.getByPlaceholder('Email').fill('driver2@test.de');
	await page.getByRole('button', { name: 'Freischalten' }).click();
	await expect(page.getByText('Freischaltung erfolgreich!')).toBeVisible();
	await expect(page.getByRole('cell', { name: 'driver2@test.de' })).toHaveText('driver2@test.de');
});

test('Deactivate driver', async ({ page }) => {
	await login(page, ENTREPENEUR);
	await page.getByRole('link', { name: 'Fahrer' }).click();
	await page
		.getByRole('row', { name: 'driver2@test.de Zugang zum Unternehmen löschen' })
		.getByRole('button')
		.click();
	await expect(page.getByRole('cell', { name: 'driver2@test.de' })).not.toBeVisible();
});

test('Activate administrator', async ({ page }) => {
	await signup(page, { email: 'admin2@test.de', password: 'longEnough2' });
	await signup(page, { email: 'admin3@test.de', password: 'longEnough2' });
	await setCompanyData(page, ENTREPENEUR, COMPANY1);

	await page.getByRole('link', { name: 'Verwaltung' }).click();
	await page.getByPlaceholder('Email').fill('admin2@test.de');
	await page.getByRole('button', { name: 'Freischalten' }).click();
	await expect(page.getByText('Freischaltung erfolgreich!')).toBeVisible();
	await expect(page.getByRole('cell', { name: 'admin2@test.de' })).toBeVisible();

	await page.reload();
	await page.getByPlaceholder('Email').fill('admin3@test.de');
	await page.getByRole('button', { name: 'Freischalten' }).click();
	await expect(page.getByText('Freischaltung erfolgreich!')).toBeVisible();
	await expect(page.getByRole('cell', { name: 'admin3@test.de' })).toBeVisible();
});

test('Deactivate administrator', async ({ page }) => {
	await login(page, ENTREPENEUR);
	await page.getByRole('link', { name: 'Verwaltung' }).click();
	await page
		.getByRole('row', { name: 'admin3@test.de Zugang zum Unternehmen löschen' })
		.getByRole('button')
		.click();
	await expect(page.getByRole('cell', { name: 'admin3@test.de' })).not.toBeVisible();
});
