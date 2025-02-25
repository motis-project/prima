import { expect, test } from '@playwright/test';
import { execSQL, login, signup, ADMIN, TAXI_OWNER } from './utils';
import { sql } from 'kysely';

test.describe.configure({ mode: 'serial' });

test('signup admin', async ({ page }) => {
	await signup(page, ADMIN);
	await execSQL(sql`UPDATE "user" SET is_admin = true WHERE email = ${ADMIN.email}`);
});

test('signup taxi', async ({ page }) => {
	await signup(page, TAXI_OWNER);
});

test('activate taxi', async ({ page }) => {
	await login(page, ADMIN);
	await page.goto('/admin/taxi-owners');
	await page.getByRole('textbox', { name: 'E-Mail' }).fill(TAXI_OWNER.email);
	await page.getByRole('button', { name: 'Taxiunternehmer freischalten' }).click();
	await expect(page.getByText('Nutzer freigeschaltet.')).toBeVisible();
});
