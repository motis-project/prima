import { test, expect, type Page } from '@playwright/test';
import { Kysely, PostgresDialect, RawBuilder, sql } from 'kysely';
import { dbConfig } from './config';
import pg from 'pg';

test.use({ locale: 'de-DE' });

export type UserCredentials = {
	email: string;
	password: string;
};

export type Company = {
	name: string;
	address: string;
	zone: string;
	community: string;
};

export const ADMIN: UserCredentials = {
	email: 'master@example.com',
	password: 'longEnough1'
};

export const TAXI_OWNER: UserCredentials = {
	email: 'taxi1@test.de',
	password: 'longEnough2'
};

export const TAXI_OWNER_2: UserCredentials = {
	email: 'taxi2@test.de',
	password: 'longEnough2'
};

export const COMPANY1: Company = {
	name: 'Taxi Weißwasser',
	address: 'Werner-Seelenbinder-Straße 70A, 02943 Weißwasser/Oberlausitz',
	zone: 'Weißwasser',
	community: 'Weißwasser/O.L.'
};

export const COMPANY2: Company = {
	name: 'Taxi Gablenz',
	address: 'Schulstraße 21, 02953 Gablenz',
	zone: 'Weißwasser',
	community: 'Gablenz'
};

export async function execSQL(sql: RawBuilder<unknown>) {
	const db = new Kysely<unknown>({
		dialect: new PostgresDialect({
			pool: new pg.Pool({ ...dbConfig, database: 'prima' })
		})
	});
	await sql.execute(db);
	db.destroy();
}

export async function login(page: Page, credentials: UserCredentials) {
	await page.goto('/account/login');
	await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
	await page.getByRole('textbox', { name: 'E-Mail' }).fill(credentials.email);
	await page.getByRole('textbox', { name: 'Passwort' }).fill(credentials.password);
	await page.getByRole('button', { name: 'Login' }).click();
	await page.waitForTimeout(500);
}

export async function signup(page: Page, credentials: UserCredentials) {
	await page.goto('/account/signup');
	await expect(page.getByRole('heading', { name: 'Nutzerkonto erstellen' })).toBeVisible();
	await page.getByRole('textbox', { name: 'E-Mail' }).fill(credentials.email);
	await page.getByRole('textbox', { name: 'Passwort' }).fill(credentials.password);
	await page.getByRole('textbox', { name: 'Name' }).fill(credentials.email);
	await page.getByRole('button', { name: 'Nutzerkonto erstellen' }).click();

	await execSQL(sql`UPDATE "user" SET is_email_verified = true WHERE email = ${credentials.email}`);

	await page.goto('/account/settings');
	await page.getByRole('button', { name: 'Abmelden' }).click();
}

export async function setCompanyData(page: Page, user: UserCredentials, company: Company) {
	await login(page, user);
	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();

	await page.getByLabel('Name').fill(company.name);
	await page.getByLabel('Unternehmenssitz').fill(company.address);
	await page.waitForTimeout(250);
	await page.getByLabel('Pflichtfahrgebiet').selectOption({ label: company.zone });
	await page.getByLabel('Gemeinde').selectOption({ label: company.community });
	await page.screenshot({ path: 'screenshots/afterEnteringCompanyData.png', fullPage: true });
	await page.getByRole('button', { name: 'Übernehmen' }).click();
	await page.waitForTimeout(500);
	await page.screenshot({ path: 'screenshots/afterSetCompany.png', fullPage: true });
}

export async function addVehicle(page: Page, licensePlate: string) {
	await login(page, TAXI_OWNER);
	await page.goto('/taxi/company');
	await page.waitForTimeout(500);
	await page.screenshot({ path: 'screenshots/beforeNavigateToTaxi.png', fullPage: true });
	await page.getByRole('link', { name: 'Taxi' }).click();
	await expect(page.getByRole('heading', { name: 'Fahrzeuge und Touren' })).toBeVisible();
	await page.waitForTimeout(500);
	await page.getByRole('button', { name: 'Fahrzeug hinzufügen' }).click();
	await page.getByPlaceholder('DA-AB-1234').fill(licensePlate);
	await page.getByLabel('3 Passagiere').check();
	await page
		.locator('button')
		.filter({ hasText: /^Fahrzeug hinzufügen$/ })
		.click();
	await page.waitForTimeout(500);
}
