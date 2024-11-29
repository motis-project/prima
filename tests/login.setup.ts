import { expect, test } from '@playwright/test';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { dbConfig } from './config';
import pg from 'pg';
import { login, signup, MAINTAINER, ENTREPENEUR } from './utils';

test.describe.configure({ mode: 'serial' });

test('signup maintainer', async ({ page }) => {
	await signup(page, MAINTAINER);
	const db = new Kysely<unknown>({
		dialect: new PostgresDialect({
			pool: new pg.Pool({ ...dbConfig, database: 'prima' })
		})
	});
	await sql`UPDATE auth_user SET is_maintainer = true WHERE email = 'master@example.com'`.execute(
		db
	);
	db.destroy();
});

test('signup taxi', async ({ page }) => {
	await signup(page, ENTREPENEUR);
});

test('activate taxi', async ({ page }) => {
	await login(page, MAINTAINER);
	await expect(page.getByRole('heading', { name: 'Unternehmer freischalten' })).toBeVisible();
	await page.getByLabel('Email').fill(ENTREPENEUR.email);
	await page.getByRole('button', { name: 'Unternehmer freischalten' }).click();
	await page.screenshot({ path: 'screenshots/afterClickActivation.png', fullPage: true });
	await expect(page.getByText('Freischalten erfolgreich!')).toBeVisible();
});
