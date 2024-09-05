import { expect, test, type Page } from '@playwright/test';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { dbConfig } from './config';
import pg from 'pg';

type UserCredentials = {
	email: string;
	password: string;
};

const MAINTAINER: UserCredentials = {
	email: 'master@example.com',
	password: 'longEnough1'
};

const ENTREPENEUR: UserCredentials = {
	email: 'taxi@example.com',
	password: 'longEnough2'
};

test.describe.configure({ mode: 'serial' });

async function login(page: Page, credentials: UserCredentials) {
	await page.goto('/login');
	await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
	await page.getByLabel('Email').fill(credentials.email);
	await page.getByLabel('Password').fill(credentials.password);
	await page.getByRole('button', { name: 'Login' }).click();
}

async function signup(page: Page, credentials: UserCredentials) {
	await page.goto('/signup');
	await expect(page.getByRole('heading', { name: 'Neuen Account erstellen' })).toBeVisible();
	await page.getByLabel('Email').fill(credentials.email);
	await page.getByLabel('Password').fill(credentials.password);
	await page.getByRole('button', { name: 'Account erstellen' }).click();
	await expect(
		page.getByRole('heading', { name: 'Willkommen beim Projekt PrimaÖV!' })
	).toBeVisible();
}

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
	await expect(page.getByText('Freischalten erfolgreich!')).toBeVisible();
});

test('taxi set base data', async ({ page }) => {
	await login(page, ENTREPENEUR);

	await expect(page.getByRole('heading', { name: 'Stammdaten ihres Unternehmens' })).toBeVisible();

	await page.getByLabel('Name').fill('Mein Taxi Unternehmen');
	await page.getByLabel('Unternehmenssitz').fill('Wilhelm-Busch-Straße 3, 02625 Bautzen');
	await page.getByLabel('Pflichtfahrgebiet').selectOption({ label: 'Altkreis Bautzen' });
	await page.getByLabel('Gemeinde').selectOption({ label: 'Bautzen' });
	await page.getByRole('button', { name: 'Übernehmen' }).click();

	await expect(page.getByText('Aktualisierung erfolgreich.')).toBeVisible();

	const checkData = async () => {
		await expect(page.getByLabel('Name')).toHaveValue('Mein Taxi Unternehmen');
		await expect(page.getByLabel('Unternehmenssitz')).toHaveValue(
			'Wilhelm-Busch-Straße 3, 02625 Bautzen'
		);
		await expect(page.getByLabel('Pflichtfahrgebiet')).toHaveValue('1' /* Altkreis Bautzen */);
		await expect(page.getByLabel('Gemeinde')).toHaveValue('7' /* Bautzen */);
	};

	await checkData();
	await page.reload();
	await checkData();
});
