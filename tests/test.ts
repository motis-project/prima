import { expect, test, type Page } from '@playwright/test';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { dbConfig } from './config';
import pg from 'pg';

const EMAIL_MASTER = 'master@example.com';
const PASSWORD_MASTER = 'longEnough1';
const EMAIL_TAXI = 'taxi@example.com';
const PASSWORD_TAXI = 'longEnough2';

test.describe.configure({ mode: 'serial' });

async function hammerF5(page: Page) {
	await page.reload({ waitUntil: 'commit' });
	await page.reload({ waitUntil: 'commit' });
	await page.reload({ waitUntil: 'commit' });
	await page.reload({ waitUntil: 'commit' });
	await page.reload({ waitUntil: 'commit' });
	await page.reload({ waitUntil: 'commit' });
	await page.reload({ waitUntil: 'commit' });
	await page.waitForLoadState('networkidle');
	await page.waitForLoadState('networkidle');
}

async function login(page: Page, email: string, password: string) {
	await page.goto('/login');
	await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Login' }).click();
}

async function signup(page: Page, email: string, password: string) {
	await page.goto('/signup');
	await expect(page.getByRole('heading', { name: 'Neuen Account erstellen' })).toBeVisible();
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Account erstellen' }).click();
	await expect(
		page.getByRole('heading', { name: 'Willkommen beim Projekt PrimaÖV!' })
	).toBeVisible();
}

test('signup master', async ({ page }) => {
	await signup(page, EMAIL_MASTER, PASSWORD_MASTER);
});

test('signup taxi', async ({ page }) => {
	await signup(page, EMAIL_TAXI, PASSWORD_TAXI);

	// Manually activate maintainer via DB query
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

test('activate taxi', async ({ page }) => {
	await login(page, EMAIL_MASTER, PASSWORD_MASTER);
	await expect(page.getByRole('heading', { name: 'Unternehmer freischalten' })).toBeVisible();
	await page.getByLabel('Email').fill(EMAIL_TAXI);
	await page.getByRole('button', { name: 'Unternehmer freischalten' }).click();
	await expect(page.getByText('Freischalten erfolgreich!')).toBeVisible();
});

test('taxi set base data', async ({ page }) => {
	await login(page, EMAIL_TAXI, PASSWORD_TAXI);

	await expect(page.getByRole('heading', { name: 'Stammdaten ihres Unternehmens' })).toBeVisible();

	await page.getByLabel('Name').fill('Mein Taxi Unternehmen');
	await page.getByLabel('Unternehmenssitz').fill('Wilhelm-Busch-Straße 3, 02625 Bautzen');
	await page.getByLabel('Pflichtfahrgebiet').selectOption({ label: 'Altkreis Bautzen' });
	await page.getByLabel('Gemeinde').selectOption({ label: 'Bautzen' });
	await page.getByRole('button', { name: 'Übernehmen' }).click();

	await hammerF5(page);

	await expect(page.getByLabel('Name')).toHaveValue('Mein Taxi Unternehmen');
	await expect(page.getByLabel('Unternehmenssitz')).toHaveValue(
		'Wilhelm-Busch-Straße 3, 02625 Bautzen'
	);
	await expect(page.getByLabel('Pflichtfahrgebiet')).toHaveValue('1' /* Altkreis Bautzen */);
	await expect(page.getByLabel('Gemeinde')).toHaveValue('7' /* Bautzen */);
});
