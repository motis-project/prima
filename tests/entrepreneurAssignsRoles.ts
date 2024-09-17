import { expect, test } from '@playwright/test';
import { ENTREPENEUR, setCompanyData, signup, COMPANY1, login } from './utils';

test.describe.configure({ mode: 'serial' });

test('Activate driver', async ({ page }) => {
	await signup(page, { email: 'driver@test.de', password: 'longEnough3' });
	await setCompanyData(page, ENTREPENEUR, COMPANY1);
	await page.getByRole('link', { name: 'Fahrer' }).click();
	await page.getByLabel('Email').fill('driver@test.de');
	await page.getByRole('button', { name: 'Freischalten' }).click();
	await expect(page.getByText('Freischaltung erfolgreich!')).toBeVisible();
	await expect(page.getByRole('cell', { name: 'driver@test.de' })).toHaveText('driver@test.de');
});

test('Deactivate driver', async ({ page }) => {
	await login(page, ENTREPENEUR);
	await page.getByRole('link', { name: 'Fahrer' }).click();
	await page.waitForTimeout(100);
	await page.getByRole('button', { name: 'x' }).click();
	await page.waitForTimeout(100);
	await expect(page.getByRole('cell', { name: 'driver@test.de' })).not.toBeVisible();
});

test('Activate administrator', async ({ page }) => {
	await signup(page, { email: 'admin2@test.de', password: 'longEnough3' });
	await setCompanyData(page, ENTREPENEUR, COMPANY1);
	await page.getByRole('link', { name: 'Verwaltung' }).click();
	await page.getByLabel('Email').fill('admin2@test.de');
	await page.getByRole('button', { name: 'Freischalten' }).click();
	await expect(page.getByText('Freischaltung erfolgreich!')).toBeVisible();
	await expect(page.getByRole('cell', { name: 'admin2@test.de' })).toBeVisible();
});

test('Deactivate administrator', async ({ page }) => {
	await login(page, ENTREPENEUR);
	await page.getByRole('link', { name: 'Verwaltung' }).click();
	await page.waitForTimeout(100);
	await page.getByRole('row', { name: 'admin2@test.de x' }).getByRole('button').click();
	await page.waitForTimeout(100);
	await expect(page.getByRole('cell', { name: 'admin2@test.de' })).not.toBeVisible();
});
