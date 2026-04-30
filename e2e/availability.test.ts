import { expect, test, type Page } from '@playwright/test';
import { sql } from 'kysely';
import { hashPassword } from '../src/lib/server/auth/password';
import {
	login,
	addVehicle,
	TAXI_OWNER,
	moveMouse,
	offset,
	dayString,
	logout,
	execSQL
} from './utils';

test.describe.configure({ mode: 'serial' });

let taxiOwnerPasswordHash: string;

test.beforeAll(async () => {
	taxiOwnerPasswordHash = await hashPassword(TAXI_OWNER.password);

	await execSQL(sql`
		DELETE FROM "session"
		WHERE user_id IN (SELECT id FROM "user" WHERE email = ${TAXI_OWNER.email})
	`);

	const company = await execSQL<{ id: number }>(sql`
		INSERT INTO company (lat, lng, name, address, zone, phone)
		VALUES (
			51.493713,
			14.6258545,
			'Taxi Weißwasser',
			'Werner-Seelenbinder-Straße 70a, Weißwasser/Oberlausitz, Weißwasser/Oberlausitz, Sachsen',
			(SELECT id FROM zone WHERE name = 'Weißwasser' ORDER BY id DESC LIMIT 1),
			'555666'
		)
		RETURNING id
	`);
	const companyId = company.rows[0].id;

	await execSQL(sql`
		INSERT INTO "user" (
			email,
			name,
			first_name,
			gender,
			zip_code,
			city,
			region,
			password_hash,
			is_email_verified,
			email_verification_code,
			email_verification_expires_at,
			password_reset_code,
			password_reset_expires_at,
			is_taxi_owner,
			is_admin,
			is_service,
			phone,
			company_id
		)
		VALUES (
			${TAXI_OWNER.email},
			${TAXI_OWNER.email},
			'Vorname',
			'o',
			'ZIP',
			'City',
			'',
			${taxiOwnerPasswordHash},
			TRUE,
			NULL,
			NULL,
			NULL,
			NULL,
			TRUE,
			FALSE,
			FALSE,
			NULL,
			${companyId}
		)
		ON CONFLICT (email) DO UPDATE SET
			name = EXCLUDED.name,
			first_name = EXCLUDED.first_name,
			gender = EXCLUDED.gender,
			zip_code = EXCLUDED.zip_code,
			city = EXCLUDED.city,
			region = EXCLUDED.region,
			password_hash = EXCLUDED.password_hash,
			is_email_verified = EXCLUDED.is_email_verified,
			email_verification_code = EXCLUDED.email_verification_code,
			email_verification_expires_at = EXCLUDED.email_verification_expires_at,
			password_reset_code = EXCLUDED.password_reset_code,
			password_reset_expires_at = EXCLUDED.password_reset_expires_at,
			is_taxi_owner = EXCLUDED.is_taxi_owner,
			is_admin = EXCLUDED.is_admin,
			is_service = EXCLUDED.is_service,
			phone = EXCLUDED.phone,
			company_id = EXCLUDED.company_id
	`);
});

export async function setAvailability(page: Page) {
	await login(page, TAXI_OWNER);
	await page.goto(`/taxi/availability?offset=${offset}&date=${dayString}`);
	await page.waitForTimeout(500);
	page.getByTestId(`GR-TU-11-${dayString}T09:45:00.000Z`).locator('div').scrollIntoViewIfNeeded();
	await page.waitForTimeout(500);
	await moveMouse(page, `GR-TU-11-${dayString}T07:00:00.000Z`);
	await page.mouse.down();
	await moveMouse(page, `GR-TU-11-${dayString}T09:45:00.000Z`);
	await page.mouse.up();
}

export async function requestRide(page: Page) {
	await login(page, TAXI_OWNER);
	await page.goto('/debug');
	await page.waitForTimeout(1000);

	await page.getByRole('textbox').fill(`${dayString}T08:30:00Z`);
	await page.getByRole('button', { name: 'Suchen' }).click();
	await expect(page.getByText('Request: ')).toBeVisible();
}

test('Add vehicle', async ({ page }) => {
	await addVehicle(page, 'GR-TU-11');
	await expect(page.getByRole('cell', { name: 'GR-TU-11' }).first()).toBeVisible();
});

test('Set availability', async ({ page }) => {
	await setAvailability(page);
	await expect(page.getByTestId(`GR-TU-11-${dayString}T06:45:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgba(0, 0, 0, 0)'
	);
	await expect(page.getByTestId(`GR-TU-11-${dayString}T07:00:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(254, 249, 195)'
	);
	await expect(page.getByTestId(`GR-TU-11-${dayString}T07:15:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(254, 249, 195)'
	);
	await expect(page.getByTestId(`GR-TU-11-${dayString}T09:30:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(254, 249, 195)'
	);
	await expect(page.getByTestId(`GR-TU-11-${dayString}T09:45:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(254, 249, 195)'
	);
	await expect(page.getByTestId(`GR-TU-11-${dayString}T10:00:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgba(0, 0, 0, 0)'
	);
});

test('Request ride', async ({ page }) => {
	await requestRide(page);
	await page.goto(`/taxi/availability?offset=${offset}&date=${dayString}`);
	await page.waitForTimeout(500);
	await expect(page.getByTestId(`GR-TU-11-${dayString}T08:00:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(251, 146, 60)'
	);
	await expect(page.getByTestId(`GR-TU-11-${dayString}T08:15:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(251, 146, 60)'
	);
	await expect(page.getByTestId(`GR-TU-11-${dayString}T08:30:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(251, 146, 60)'
	);
	await logout(page);
});
