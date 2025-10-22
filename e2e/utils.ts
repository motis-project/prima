import { test, expect, type Page } from '@playwright/test';
import { Kysely, PostgresDialect, RawBuilder, sql } from 'kysely';
import { dbConfig } from './config';
import pg from 'pg';
import { DAY, HOUR, MINUTE } from '../src/lib/util/time';
import { LICENSE_PLATE_PLACEHOLDER, LOCALE } from '../src/lib/constants';
import { getOffset } from '../src/lib/util/getOffset';

test.use({ locale: LOCALE });

export const in6Days = new Date(Math.ceil(Date.now() / DAY) * DAY + 5 * DAY);
export const dayString = in6Days.toISOString().split('T')[0];
export const offset = getOffset(in6Days.getTime() + HOUR * 12) / MINUTE;
export type UserCredentials = {
	email: string;
	password: string;
};

export type Company = {
	name: string;
	address: string;
	zone: string;
	community: string;
	phone: string;
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

export const RIDE_SHARE_PROVIDER: UserCredentials = {
	email: 'rsp@example.com',
	password: 'longEnough1'
};

export const RIDE_SHARE_CUSTOMER: UserCredentials = {
	email: 'rsc@example.com',
	password: 'longEnough1'
};

export const COMPANY1: Company = {
	name: 'Taxi Weißwasser',
	address: 'Werner-Seelenbinder-Straße 70A, 02943 Weißwasser/Oberlausitz',
	zone: 'Weißwasser',
	community: 'Weißwasser/O.L.',
	phone: '555666'
};

export const COMPANY2: Company = {
	name: 'Taxi Gablenz',
	address: 'Schulstraße 21, 02953 Gablenz',
	zone: 'Weißwasser',
	community: 'Gablenz',
	phone: '777888'
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

export async function signup(page: Page, credentials: UserCredentials, skipLogout?: boolean) {
	await page.goto('/account/signup');
	await expect(page.getByRole('heading', { name: 'Nutzerkonto erstellen' })).toBeVisible();
	await page.getByRole('textbox', { name: 'E-Mail' }).fill(credentials.email);
	await page.getByRole('textbox', { name: 'Passwort' }).fill(credentials.password);
	await page.getByRole('textbox', { name: 'Nachname' }).fill(credentials.email);
	await page.getByRole('textbox', { name: 'Vorname' }).fill('Vorname');
	await page.getByRole('textbox', { name: 'PLZ' }).fill('ZIP');
	await page.getByRole('textbox', { name: 'Ort', exact: true }).fill('City');
	await Promise.all([
		page.waitForResponse((r) => r.url().includes('/verify-email') && r.status() === 200),
		page.getByRole('button', { name: 'Nutzerkonto erstellen' }).click()
	]);

	await execSQL(sql`UPDATE "user" SET is_email_verified = true WHERE email = ${credentials.email}`);

	if (!skipLogout) {
		await page.goto('/account/settings');
		await page.waitForTimeout(1000);
		await page.screenshot({ path: 'screenshots/beforeLogout.png', fullPage: true });
		await page.getByRole('button', { name: 'Abmelden' }).click();
	}
}

async function chooseFromTypeAhead(
	page: Page,
	label: string,
	search: string,
	expectedOption: string
) {
	await page.getByLabel(label).pressSequentially(search, { delay: 10 });
	const suggestion = page.getByText(expectedOption, { exact: true });
	await suggestion.waitFor({ state: 'visible', timeout: 5000 });
	await suggestion.click();
}

export async function setCompanyData(page: Page, user: UserCredentials, company: Company) {
	await login(page, user);
	await page.goto('/taxi/company');
	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();

	await page.getByLabel('Name').fill(company.name);
	await chooseFromTypeAhead(
		page,
		'Unternehmenssitz',
		company.address,
		'Werner-Seelenbinder-Straße 70a'
	);

	await page.getByLabel('Pflichtfahrgebiet').selectOption({ label: company.zone });
	await page.locator('input[name="phone"]').pressSequentially(company.phone, { delay: 10 });
	await page.getByRole('button', { name: 'Übernehmen' }).click();
	await expect(page.getByText('Unternehmensdaten erfolgreich aktualisiert.')).toBeVisible();
}

export async function addVehicle(page: Page, licensePlate: string) {
	await login(page, TAXI_OWNER);
	await page.goto('/taxi/availability');
	await page.waitForTimeout(1000);
	await page.getByTestId('add-vehicle').click();
	await page.waitForTimeout(1000);
	await page.screenshot({ path: 'screenshots/afterAddVehicleButton.png', fullPage: true });
	await page.getByPlaceholder(LICENSE_PLATE_PLACEHOLDER).fill(licensePlate);
	await page.getByLabel('3 Passagiere').check();
	await page.getByTestId('create-vehicle').click();
}

export async function moveMouse(page: Page, id: string) {
	const element = page.getByTestId(id).locator('div');
	const { x, y, width, height } = (await element.boundingBox())!;
	await page.mouse.move(x + width / 2, y + height / 2);
}

export async function logout(page: Page) {
	await page.goto('/account/settings');
	await page.getByRole('button', { name: 'Abmelden' }).click();
}
